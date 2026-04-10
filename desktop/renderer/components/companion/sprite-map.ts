/**
 * Sprite Map — master ID + emotion → PNG asset path.
 *
 * Maps the assigned guardian master's ID to the correct sprite PNG.
 * Handles emotion→sprite-state translation.
 * Falls back to 'idle' state when a sprite variant doesn't exist.
 */

/** Sprite states available as PNG files per master. */
type SpriteState = 'idle' | 'active' | 'happy' | 'worried' | 'alert' | 'celebrate'

/**
 * Alias map for master IDs that differ from their sprite file prefix.
 * Currently empty — all PNGs use the full master ID as prefix.
 */
const MASTER_ALIASES: Record<string, string> = {}

/**
 * Emotion string → sprite state.
 * Maps ExpressionEngine emotions to the available PNG states.
 */
const EMOTION_TO_STATE: Record<string, SpriteState> = {
  neutral: 'idle',
  idle: 'idle',
  happy: 'happy',
  worried: 'worried',
  stern: 'alert',
  alert: 'alert',
  celebrate: 'celebrate',
  active: 'active',
}

/** All sprite states for preloading. */
const ALL_STATES: SpriteState[] = ['idle', 'active', 'happy', 'worried', 'alert', 'celebrate']

/**
 * Resolve the sprite file name for a master ID.
 * Applies alias mapping if any exist.
 */
function resolveSpriteName(masterId: string): string {
  return MASTER_ALIASES[masterId] ?? masterId
}

/**
 * Get the asset path for a specific master + emotion combination.
 */
export function getSpritePath(masterId: string, emotion: string): string {
  const name = resolveSpriteName(masterId)
  const state = EMOTION_TO_STATE[emotion] ?? 'idle'
  return `/sprites/${name}-${state}.png`
}

/**
 * Get all sprite paths for a master (for preloading on mount).
 * Returns an array of paths for every available state.
 */
export function getAllSpritePaths(masterId: string): string[] {
  const name = resolveSpriteName(masterId)
  return ALL_STATES.map((state) => `/sprites/${name}-${state}.png`)
}

/**
 * Get the idle sprite path (default resting state).
 */
export function getIdleSpritePath(masterId: string): string {
  return getSpritePath(masterId, 'neutral')
}
