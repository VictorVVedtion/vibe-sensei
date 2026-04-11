/**
 * Multi-provider login: Anthropic / OpenAI / Gemini
 * Minimal implementation without React Compiler pre-compilation.
 */
import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import type { LocalJSXCommandContext } from '../../commands.js';
import { ConsoleOAuthFlow } from '../../components/ConsoleOAuthFlow.js';
import { Dialog } from '../../components/design-system/Dialog.js';
import { Select } from '../../components/CustomSelect/select.js';
import { Spinner } from '../../components/Spinner.js';
import { Box, Text } from '../../ink.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';

type Provider = 'anthropic' | 'openai' | 'gemini';

// Default model for each provider when login succeeds
const PROVIDER_DEFAULT_MODEL: Record<Provider, string | null> = {
  anthropic: null,                    // keep current model (Claude default works)
  openai: 'openai/gpt-5.4',            // Latest Codex-supported model
  gemini: 'gemini/gemini-3.1-pro-preview',  // Latest Gemini 3 model
};

// Debug log helper (enable with VIBE_LOGIN_DEBUG=1, stderr is eaten by Ink)
function debugLog(msg: string): void {
  if (!process.env.VIBE_LOGIN_DEBUG) return;
  try {
    const fs = require('fs');
    fs.appendFileSync('/tmp/vibe-login-debug.log', `[${new Date().toISOString()}] ${msg}\n`);
  } catch { /* ignore */ }
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  debugLog('call() invoked');
  const jsx = <MultiLogin onDone={(success: boolean, provider?: Provider) => {
    debugLog(`onDone(${success}, ${provider})`);
    if (success && provider) {
      // Switch to the provider's default model so the user can immediately
      // start chatting with the provider they just logged into.
      const model = PROVIDER_DEFAULT_MODEL[provider];
      if (model) {
        try {
          context.setAppState((prev: any) => ({
            ...prev,
            mainLoopModelForSession: model,
            authVersion: (prev.authVersion ?? 0) + 1,
          }));
        } catch { /* ignore */ }
      } else {
        // Anthropic: still bump authVersion to refresh model resolution
        try {
          context.setAppState((prev: any) => ({
            ...prev,
            authVersion: (prev.authVersion ?? 0) + 1,
          }));
        } catch { /* ignore */ }
      }
      context.onChangeAPIKey?.();
    }
    onDone(success ? `Login successful${provider && PROVIDER_DEFAULT_MODEL[provider] ? ` — switched to ${PROVIDER_DEFAULT_MODEL[provider]}` : ''}` : 'Login cancelled');
  }} />;
  return jsx;
}

function MultiLogin({ onDone }: { onDone: (success: boolean, provider?: Provider) => void }) {
  const [provider, setProvider] = useState<Provider | null>(null);

  const handleCancel = useCallback(() => {
    onDone(false);
  }, [onDone]);
  const handleSuccess = useCallback(() => {
    onDone(true, provider ?? undefined);
  }, [onDone, provider]);

  // Step 1: Provider picker
  if (!provider) {
    return (
      <Dialog title="Login · Select Provider" onCancel={handleCancel} color="permission">
        <Box flexDirection="column" gap={1}>
          <Text bold>Choose your AI provider:</Text>
          <Select
            options={[
              { label: '  Anthropic (Claude)', value: 'anthropic' as Provider },
              { label: '  OpenAI  (ChatGPT)', value: 'openai' as Provider },
              { label: '  Google  (Gemini)',  value: 'gemini' as Provider },
            ]}
            onChange={(value: Provider) => {
              debugLog(`Select onChange: ${value}`);
              setProvider(value);
            }}
          />
        </Box>
      </Dialog>
    );
  }

  // Step 2: Provider-specific flow
  if (provider === 'anthropic') {
    return (
      <Dialog title="Login · Anthropic" onCancel={handleCancel} color="permission">
        <ConsoleOAuthFlow onDone={handleSuccess} />
      </Dialog>
    );
  }

  if (provider === 'openai') {
    return (
      <Dialog title="Login · OpenAI" onCancel={handleCancel} color="permission">
        <CodexLoginFlow onDone={handleSuccess} />
      </Dialog>
    );
  }

  if (provider === 'gemini') {
    return (
      <Dialog title="Login · Gemini" onCancel={handleCancel} color="permission">
        <GeminiPKCEFlow onDone={handleSuccess} />
      </Dialog>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// OpenAI Codex PKCE OAuth flow (ported from @mariozechner/pi-ai)
// ---------------------------------------------------------------------------

function CodexLoginFlow({ onDone }: { onDone: () => void }) {
  const [status, setStatus] = useState<'starting' | 'waiting' | 'success' | 'error'>('starting');
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { runOpenAICodexLoginFlow } = await import('../../services/api/providers/openai-codex-oauth.js');
        setStatus('waiting');
        await runOpenAICodexLoginFlow(
          async (url: string) => {
            const { openBrowser } = await import('../../utils/browser.js');
            await openBrowser(url);
          },
          (msg: string) => { if (!cancelled) setProgressMsg(msg); },
        );
        if (cancelled) return;
        setStatus('success');
        setTimeout(onDone, 1500);
      } catch (e) {
        if (cancelled) return;
        setErrorMsg((e as Error).message);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (status === 'starting') return <Box><Spinner /><Text> Preparing OpenAI OAuth...</Text></Box>;
  if (status === 'waiting') return (
    <Box flexDirection="column" gap={1}>
      <Text>{progressMsg || 'Opening browser for ChatGPT authentication...'}</Text>
      <Box><Spinner /><Text> Waiting for authorization...</Text></Box>
    </Box>
  );
  if (status === 'success') return <Text color="green">✓ OpenAI login successful!</Text>;
  return (
    <Box flexDirection="column">
      <Text color="red">OpenAI login failed: {errorMsg}</Text>
      <Text dimColor>You can also set OPENAI_API_KEY environment variable.</Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Gemini PKCE OAuth Flow (ported from OpenClaw)
// ---------------------------------------------------------------------------

function GeminiPKCEFlow({ onDone }: { onDone: () => void }) {
  const [status, setStatus] = useState<'starting' | 'waiting' | 'success' | 'error'>('starting');
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      debugLog('GeminiPKCEFlow: effect started');
      try {
        const mod = await import('../../services/api/providers/gemini-oauth.js');
        debugLog(`GeminiPKCEFlow: loaded module, keys=${Object.keys(mod).join(',')}`);
        const { startGeminiOAuthFlow } = mod;
        setStatus('waiting');
        debugLog('GeminiPKCEFlow: calling startGeminiOAuthFlow');
        await startGeminiOAuthFlow(
          async (url: string) => {
            debugLog(`GeminiPKCEFlow: openUrl callback invoked with url=${url.substring(0, 120)}...`);
            try {
              const { openBrowser } = await import('../../utils/browser.js');
              await openBrowser(url);
              debugLog('GeminiPKCEFlow: openBrowser succeeded');
            } catch (e) {
              debugLog(`GeminiPKCEFlow: openBrowser threw: ${(e as Error).message}`);
              throw e;
            }
          },
          (msg: string) => {
            debugLog(`GeminiPKCEFlow progress: ${msg}`);
            if (!cancelled) setProgressMsg(msg);
          },
        );
        debugLog('GeminiPKCEFlow: startGeminiOAuthFlow resolved (success)');
        if (cancelled) return;
        setStatus('success');
        setTimeout(onDone, 1500);
      } catch (e) {
        debugLog(`GeminiPKCEFlow: ERROR ${(e as Error).message}`);
        if (cancelled) return;
        setErrorMsg((e as Error).message);
        setStatus('error');
      }
    })();
    return () => {
      debugLog('GeminiPKCEFlow: cleanup (cancelled)');
      cancelled = true;
    };
  }, []);

  if (status === 'starting') return <Box><Spinner /><Text> Preparing Gemini OAuth...</Text></Box>;
  if (status === 'waiting') return (
    <Box flexDirection="column" gap={1}>
      <Text>{progressMsg || 'Opening browser for Google authentication...'}</Text>
      <Box><Spinner /><Text> Waiting for authorization...</Text></Box>
    </Box>
  );
  if (status === 'success') return <Text color="green">✓ Gemini login successful!</Text>;
  return (
    <Box flexDirection="column">
      <Text color="red">Gemini login failed: {errorMsg}</Text>
      <Text dimColor>You can also set GEMINI_API_KEY environment variable.</Text>
    </Box>
  );
}
