import * as React from 'react';
import { useState, useCallback } from 'react';
import { feature } from 'bun:bundle';
import { resetCostState } from '../../bootstrap/state.js';
import { clearTrustedDeviceToken, enrollTrustedDevice } from '../../bridge/trustedDevice.js';
import type { LocalJSXCommandContext } from '../../commands.js';
import { ConfigurableShortcutHint } from '../../components/ConfigurableShortcutHint.js';
import { ConsoleOAuthFlow } from '../../components/ConsoleOAuthFlow.js';
import { Dialog } from '../../components/design-system/Dialog.js';
import { Select } from '../../components/CustomSelect/select.js';
import { Spinner } from '../../components/Spinner.js';
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js';
import { Box, Text } from '../../ink.js';
import { refreshGrowthBookAfterAuthChange } from '../../services/analytics/growthbook.js';
import { refreshPolicyLimits } from '../../services/policyLimits/index.js';
import { refreshRemoteManagedSettings } from '../../services/remoteManagedSettings/index.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
import { stripSignatureBlocks } from '../../utils/messages.js';
import { checkAndDisableAutoModeIfNeeded, checkAndDisableBypassPermissionsIfNeeded, resetAutoModeGateCheck, resetBypassPermissionsCheck } from '../../utils/permissions/bypassPermissionsKillswitch.js';
import { resetUserCache } from '../../utils/user.js';
import { openBrowser } from '../../utils/browser.js';

type Provider = 'anthropic' | 'openai' | 'gemini';

export async function call(onDone: LocalJSXCommandOnDone, context: LocalJSXCommandContext): Promise<React.ReactNode> {
  return <Login onDone={async success => {
    context.onChangeAPIKey();
    context.setMessages(stripSignatureBlocks);
    if (success) {
      resetCostState();
      void refreshRemoteManagedSettings();
      void refreshPolicyLimits();
      resetUserCache();
      refreshGrowthBookAfterAuthChange();
      clearTrustedDeviceToken();
      void enrollTrustedDevice();
      resetBypassPermissionsCheck();
      const appState = context.getAppState();
      void checkAndDisableBypassPermissionsIfNeeded(appState.toolPermissionContext, context.setAppState);
      if (feature('TRANSCRIPT_CLASSIFIER')) {
        resetAutoModeGateCheck();
        void checkAndDisableAutoModeIfNeeded(appState.toolPermissionContext, context.setAppState, appState.fastMode);
      }
      context.setAppState(prev => ({
        ...prev,
        authVersion: prev.authVersion + 1
      }));
    }
    onDone(success ? 'Login successful' : 'Login interrupted');
  }} />;
}

export function Login(props: {
  onDone: (success: boolean, model?: string) => void;
  startingMessage?: string;
}) {
  const mainLoopModel = useMainLoopModel();
  const [provider, setProvider] = useState<Provider | null>(null);

  // Debug: confirm our new login code is loaded
  React.useEffect(() => {
    console.error('[login] Provider picker mounted, provider:', provider);
  }, [provider]);

  const onCancel = useCallback(
    () => props.onDone(false, mainLoopModel),
    [props, mainLoopModel],
  );
  const onSuccess = useCallback(
    () => props.onDone(true, mainLoopModel),
    [props, mainLoopModel],
  );

  // Provider not yet selected → show picker
  if (!provider) {
    return (
      <Dialog title="Login" onCancel={onCancel} color="permission" inputGuide={inputGuide}>
        <Box flexDirection="column" gap={1}>
          <Text>Select provider:</Text>
          <Select
            options={[
              { label: '1. Anthropic (Claude)', value: 'anthropic' as Provider },
              { label: '2. OpenAI  (ChatGPT)', value: 'openai' as Provider },
              { label: '3. Google  (Gemini)', value: 'gemini' as Provider },
            ]}
            onChange={(value: Provider) => setProvider(value)}
          />
        </Box>
      </Dialog>
    );
  }

  // Anthropic → existing ConsoleOAuthFlow
  if (provider === 'anthropic') {
    return (
      <Dialog title="Login · Anthropic" onCancel={onCancel} color="permission" inputGuide={inputGuide}>
        <ConsoleOAuthFlow onDone={onSuccess} startingMessage={props.startingMessage} />
      </Dialog>
    );
  }

  // OpenAI → Codex device flow
  if (provider === 'openai') {
    return (
      <Dialog title="Login · OpenAI" onCancel={onCancel} color="permission" inputGuide={inputGuide}>
        <OpenAILoginFlow onDone={onSuccess} onCancel={onCancel} />
      </Dialog>
    );
  }

  // Gemini → Google OAuth
  if (provider === 'gemini') {
    return (
      <Dialog title="Login · Gemini" onCancel={onCancel} color="permission" inputGuide={inputGuide}>
        <GeminiLoginFlow onDone={onSuccess} onCancel={onCancel} />
      </Dialog>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// OpenAI Login (delegates to `codex login`)
// ---------------------------------------------------------------------------

function OpenAILoginFlow({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [status, setStatus] = useState<'starting' | 'waiting' | 'success' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        // Check if codex CLI exists
        try {
          await execAsync('command -v codex');
        } catch {
          if (cancelled) return;
          setErrorMsg('Codex CLI not found. Install: npm install -g @openai/codex');
          setStatus('error');
          return;
        }

        setStatus('waiting');

        // Run codex login (opens browser for ChatGPT auth)
        await execAsync('codex login 2>&1', {
          timeout: 120_000,
          env: { ...process.env, FORCE_COLOR: '0' },
        });

        if (cancelled) return;

        // Verify credentials exist after login
        const { resolveCodexAuth } = await import('../../services/api/providers/openai-codex-oauth.js');
        const token = await resolveCodexAuth();

        if (token) {
          setStatus('success');
          setTimeout(onDone, 1500);
        } else {
          setErrorMsg('Login completed but no credentials found.');
          setStatus('error');
        }
      } catch (e) {
        if (cancelled) return;
        setErrorMsg((e as Error).message);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (status === 'starting') {
    return <Box><Spinner /><Text> Checking Codex CLI...</Text></Box>;
  }

  if (status === 'waiting') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text>Running <Text bold>codex login</Text>...</Text>
        <Text dimColor>A browser window should open for OpenAI authentication.</Text>
        <Box><Spinner /><Text> Waiting for authorization...</Text></Box>
      </Box>
    );
  }

  if (status === 'success') {
    return <Text color="green">✓ OpenAI login successful!</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text color="red">OpenAI login failed: {errorMsg}</Text>
      <Text dimColor>You can also set OPENAI_API_KEY environment variable.</Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Gemini Login (delegates to `gemini auth login`)
// ---------------------------------------------------------------------------

function GeminiLoginFlow({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [status, setStatus] = useState<'starting' | 'waiting' | 'success' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Check if gemini CLI is available
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        // Check if gemini CLI exists
        try {
          await execAsync('command -v gemini');
        } catch {
          if (cancelled) return;
          setErrorMsg('Gemini CLI not found. Install: npm install -g @google/gemini-cli');
          setStatus('error');
          return;
        }

        setStatus('waiting');

        // Run gemini auth login (interactive — opens browser)
        const proc = await execAsync('gemini auth login 2>&1', {
          timeout: 120_000,
          env: { ...process.env, FORCE_COLOR: '0' },
        });

        if (cancelled) return;

        // Verify credentials exist after login
        const { resolveGeminiAuth } = await import('../../services/api/providers/gemini-oauth.js');
        const auth = await resolveGeminiAuth();

        if (auth) {
          setStatus('success');
          setTimeout(onDone, 1500);
        } else {
          setErrorMsg('Login completed but no credentials found.');
          setStatus('error');
        }
      } catch (e) {
        if (cancelled) return;
        setErrorMsg((e as Error).message);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (status === 'starting') {
    return <Box><Spinner /><Text> Checking Gemini CLI...</Text></Box>;
  }

  if (status === 'waiting') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text>Running <Text bold>gemini auth login</Text>...</Text>
        <Text dimColor>A browser window should open for Google authentication.</Text>
        <Box><Spinner /><Text> Waiting for authorization...</Text></Box>
      </Box>
    );
  }

  if (status === 'success') {
    return <Text color="green">✓ Gemini login successful!</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text color="red">Gemini login failed: {errorMsg}</Text>
      <Text dimColor>You can also set GEMINI_API_KEY environment variable.</Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function inputGuide(exitState: { pending: boolean; keyName: string }) {
  return exitState.pending
    ? <Text>Press {exitState.keyName} again to exit</Text>
    : <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" />;
}
