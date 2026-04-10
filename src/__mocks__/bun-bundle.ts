/**
 * Vitest polyfill for bun:bundle — mirrors the runtime polyfill in cli.tsx.
 * Bun's build-time macro `feature()` always returns false except for BUDDY.
 */
export function feature(name: string): boolean {
  if (name === 'BUDDY') return true
  return false
}
