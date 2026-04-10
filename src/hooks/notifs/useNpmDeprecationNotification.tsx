import { useStartupNotification } from './useStartupNotification.js';
const WELCOME_MESSAGE = 'Welcome to Vibe Sensei. Type a trade command to begin. /help for commands.';
export function useNpmDeprecationNotification() {
  useStartupNotification(_temp);
}
async function _temp() {
  return {
    timeoutMs: 8000,
    key: "vibe-sensei-welcome",
    text: WELCOME_MESSAGE,
    color: "info" as const,
    priority: "low" as const
  };
}
