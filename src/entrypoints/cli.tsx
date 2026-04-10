// Runtime polyfill for bun:bundle (build-time macros)
const feature = (_name: string) => {
    // Enable BUDDY (guardian system) in vibe-sensei
    if (_name === 'BUDDY') return true;
    return false;
};
if (typeof globalThis.MACRO === "undefined") {
    (globalThis as any).MACRO = {
        VERSION: "0.3.0",
        BUILD_TIME: new Date().toISOString(),
        FEEDBACK_CHANNEL: "",
        ISSUES_EXPLAINER: "",
        NATIVE_PACKAGE_URL: "",
        PACKAGE_URL: "",
        VERSION_CHANGELOG: "",
    };
}
// Build-time constants — normally replaced by Bun bundler at compile time
(globalThis as any).BUILD_TARGET = "external";
(globalThis as any).BUILD_ENV = "production";
(globalThis as any).INTERFACE_TYPE = "stdio";

// Bugfix for corepack auto-pinning, which adds yarnpkg to peoples' package.jsons
// eslint-disable-next-line custom-rules/no-top-level-side-effects
process.env.COREPACK_ENABLE_AUTO_PIN = "0";

// Set max heap size for child processes in CCR environments (containers have 16GB)
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level, custom-rules/safe-env-boolean-check
if (process.env.CLAUDE_CODE_REMOTE === "true") {
    // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
    const existing = process.env.NODE_OPTIONS || "";
    // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
    process.env.NODE_OPTIONS = existing
        ? `${existing} --max-old-space-size=8192`
        : "--max-old-space-size=8192";
}

/**
 * Bootstrap entrypoint - checks for special flags before loading the full CLI.
 * All imports are dynamic to minimize module evaluation for fast paths.
 * Fast-path for --version has zero imports beyond this file.
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    // --demo: zero-key demo mode. Set env before anything else loads.
    if (args.includes('--demo')) {
        process.env.IS_DEMO = '1';
    }

    // Fast-path for --version/-v: zero module loading needed
    if (
        args.length === 1 &&
        (args[0] === "--version" || args[0] === "-v" || args[0] === "-V")
    ) {
        // MACRO.VERSION is inlined at build time
        // biome-ignore lint/suspicious/noConsole:: intentional console output
        console.log(`${MACRO.VERSION} (Vibe Sensei)`);
        return;
    }

    // For all other paths, load the startup profiler
    const { profileCheckpoint } = await import("../utils/startupProfiler.js");
    profileCheckpoint("cli_entry");

    if (process.argv[2] === "--claude-in-chrome-mcp") {
        profileCheckpoint("cli_claude_in_chrome_mcp_path");
        const { runClaudeInChromeMcpServer } =
            await import("../utils/claudeInChrome/mcpServer.js");
        await runClaudeInChromeMcpServer();
        return;
    } else if (process.argv[2] === "--chrome-native-host") {
        profileCheckpoint("cli_chrome_native_host_path");
        const { runChromeNativeHost } =
            await import("../utils/claudeInChrome/chromeNativeHost.js");
        await runChromeNativeHost();
        return;
    }

    // Fast-path for `claude remote-control` (also accepts legacy `claude remote` / `claude sync` / `claude bridge`):
    // serve local machine as bridge environment.
    // feature() must stay inline for build-time dead code elimination;
    // isBridgeEnabled() checks the runtime GrowthBook gate.
    if (
        feature("BRIDGE_MODE") &&
        (args[0] === "remote-control" ||
            args[0] === "rc" ||
            args[0] === "remote" ||
            args[0] === "sync" ||
            args[0] === "bridge")
    ) {
        profileCheckpoint("cli_bridge_path");
        const { enableConfigs } = await import("../utils/config.js");
        enableConfigs();
        const { getBridgeDisabledReason, checkBridgeMinVersion } =
            await import("../bridge/bridgeEnabled.js");
        const { BRIDGE_LOGIN_ERROR } = await import("../bridge/types.js");
        const { bridgeMain } = await import("../bridge/bridgeMain.js");
        const { exitWithError } = await import("../utils/process.js");

        // Auth check must come before the GrowthBook gate check — without auth,
        // GrowthBook has no user context and would return a stale/default false.
        // getBridgeDisabledReason awaits GB init, so the returned value is fresh
        // (not the stale disk cache), but init still needs auth headers to work.
        const { getClaudeAIOAuthTokens } = await import("../utils/auth.js");
        if (!getClaudeAIOAuthTokens()?.accessToken) {
            exitWithError(BRIDGE_LOGIN_ERROR);
        }
        const disabledReason = await getBridgeDisabledReason();
        if (disabledReason) {
            exitWithError(`Error: ${disabledReason}`);
        }
        const versionError = checkBridgeMinVersion();
        if (versionError) {
            exitWithError(versionError);
        }

        // Bridge is a remote control feature - check policy limits
        const { waitForPolicyLimitsToLoad, isPolicyAllowed } =
            await import("../services/policyLimits/index.js");
        await waitForPolicyLimitsToLoad();
        if (!isPolicyAllowed("allow_remote_control")) {
            exitWithError(
                "Error: Remote Control is disabled by your organization's policy.",
            );
        }
        await bridgeMain(args.slice(1));
        return;
    }

    // Fast-path for --worktree --tmux: exec into tmux before loading full CLI
    const hasTmuxFlag =
        args.includes("--tmux") || args.includes("--tmux=classic");
    if (
        hasTmuxFlag &&
        (args.includes("-w") ||
            args.includes("--worktree") ||
            args.some((a) => a.startsWith("--worktree=")))
    ) {
        profileCheckpoint("cli_tmux_worktree_fast_path");
        const { enableConfigs } = await import("../utils/config.js");
        enableConfigs();
        const { isWorktreeModeEnabled } =
            await import("../utils/worktreeModeEnabled.js");
        if (isWorktreeModeEnabled()) {
            const { execIntoTmuxWorktree } =
                await import("../utils/worktree.js");
            const result = await execIntoTmuxWorktree(args);
            if (result.handled) {
                return;
            }
            // If not handled (e.g., error), fall through to normal CLI
            if (result.error) {
                const { exitWithError } = await import("../utils/process.js");
                exitWithError(result.error);
            }
        }
    }

    // Redirect common update flag mistakes to the update subcommand
    if (
        args.length === 1 &&
        (args[0] === "--update" || args[0] === "--upgrade")
    ) {
        process.argv = [process.argv[0]!, process.argv[1]!, "update"];
    }

    // --bare: set SIMPLE early so gates fire during module eval / commander
    // option building (not just inside the action handler).
    if (args.includes("--bare")) {
        process.env.CLAUDE_CODE_SIMPLE = "1";
    }

    // No special flags detected, load and run the full CLI
    const { startCapturingEarlyInput } = await import("../utils/earlyInput.js");
    startCapturingEarlyInput();
    profileCheckpoint("cli_before_main_import");
    const { main: cliMain } = await import("../main.jsx");
    profileCheckpoint("cli_after_main_import");
    await cliMain();
    profileCheckpoint("cli_after_main_complete");
}

// eslint-disable-next-line custom-rules/no-top-level-side-effects
void main();
