/**
 * useAssistantHistory stub — KAIROS assistant mode disabled in Vibe Sensei.
 * Original hook lazy-loaded assistant session history on scroll-up.
 * Kept as a no-op stub because REPL.tsx may reference it behind a KAIROS gate.
 */

import type { ScrollBoxHandle } from '../ink/components/ScrollBox.js'

type Result = {
  maybeLoadOlder: (handle: ScrollBoxHandle) => void
}

export function useAssistantHistory(_props: unknown): Result {
  return { maybeLoadOlder: () => {} }
}
