/**
 * Terminal inline image renderer for guardian sprites.
 *
 * Supports:
 * - iTerm2 inline image protocol (\033]1337;File=...)
 * - Kitty graphics protocol (\033_G...)
 * - ASCII art fallback via sprite-atlas.ts
 *
 * Usage:
 *   const output = await renderSprite('warren_buffett', 'idle', 'large')
 *   process.stdout.write(output)
 */

import * as fs from 'fs'
import * as path from 'path'
import { env } from '../utils/env.js'
import { wrapForMultiplexer } from '../ink/termio/osc.js'
import { MASTER_PORTRAITS, type Emotion } from '../buddy/sprite-atlas.js'
import type { Master } from '../buddy/types.js'

export type SpriteSize = 'large' | 'small' | 'avatar'

/** Character row heights for each sprite size */
const SIZE_TO_ROWS: Record<SpriteSize, number> = {
  large: 10,
  small: 5,
  avatar: 3,
}

/** Character column widths for each sprite size */
const SIZE_TO_COLS: Record<SpriteSize, number> = {
  large: 20,
  small: 10,
  avatar: 6,
}

type ImageProtocol = 'iterm2' | 'kitty' | 'none'

/** Detect which inline image protocol the terminal supports */
function detectProtocol(): ImageProtocol {
  const termProgram = process.env['TERM_PROGRAM'] ?? ''
  const term = process.env['TERM'] ?? ''

  // iTerm2 and compatible terminals
  if (termProgram === 'iTerm.app' || termProgram === 'WezTerm') {
    return 'iterm2'
  }

  // Kitty terminal
  if (term === 'xterm-kitty' || termProgram === 'kitty') {
    return 'kitty'
  }

  return 'none'
}

let _cachedProtocol: ImageProtocol | undefined

/** Get the terminal's image protocol (cached) */
export function getImageProtocol(): ImageProtocol {
  if (_cachedProtocol === undefined) {
    _cachedProtocol = detectProtocol()
  }
  return _cachedProtocol
}

/** Check if the terminal supports inline images */
export function supportsInlineImages(): boolean {
  return getImageProtocol() !== 'none'
}

/**
 * Resolve the filesystem path to a sprite PNG.
 * Handles both regular masters and ghost sprites.
 */
function getSpritePath(masterId: string, emotion: string): string {
  // Map emotion states to sprite file names
  const emotionMap: Record<string, string> = {
    neutral: 'idle',
    happy: 'happy',
    worried: 'worried',
    stern: 'alert',
    idle: 'idle',
    active: 'active',
    alert: 'alert',
    celebrate: 'celebrate',
  }
  const spriteEmotion = emotionMap[emotion] ?? 'idle'

  // Try project root assets directory
  const projectRoot = path.resolve(import.meta.dir, '..', '..')
  return path.join(projectRoot, 'assets', 'sprites', `${masterId}-${spriteEmotion}.png`)
}

/**
 * Render a sprite as an iTerm2 inline image escape sequence.
 */
function renderITerm2(pngData: Buffer, rows: number, cols: number): string {
  const base64 = pngData.toString('base64')
  const params = [
    `size=${pngData.length}`,
    'inline=1',
    `height=${rows}`,
    `width=${cols}`,
    'preserveAspectRatio=1',
  ].join(';')

  const sequence = `\x1b]1337;File=${params}:${base64}\x07`
  return wrapForMultiplexer(sequence)
}

/**
 * Render a sprite as a Kitty graphics protocol escape sequence.
 */
function renderKitty(pngData: Buffer, rows: number, cols: number): string {
  const base64 = pngData.toString('base64')
  // Kitty uses chunked transmission for large payloads
  const chunkSize = 4096
  const chunks: string[] = []

  for (let i = 0; i < base64.length; i += chunkSize) {
    const chunk = base64.slice(i, i + chunkSize)
    const isLast = i + chunkSize >= base64.length
    const more = isLast ? 0 : 1

    if (i === 0) {
      // First chunk includes metadata
      chunks.push(`\x1b_Ga=T,f=100,r=${rows},c=${cols},m=${more};${chunk}\x1b\\`)
    } else {
      chunks.push(`\x1b_Gm=${more};${chunk}\x1b\\`)
    }
  }

  return wrapForMultiplexer(chunks.join(''))
}

/**
 * Get ASCII art fallback for a master (from sprite-atlas).
 */
function getAsciiFallback(masterId: string, emotion: Emotion): string {
  const portrait = MASTER_PORTRAITS[masterId as Master]
  if (!portrait) return '(?_?)'

  // Use emotion variant if available, otherwise neutral
  const lines = portrait.emotions?.[emotion] ?? portrait.portrait
  return lines.join('\n')
}

/**
 * Get compact face fallback (single-line ASCII face).
 */
export function getCompactFace(masterId: string): string {
  const portrait = MASTER_PORTRAITS[masterId as Master]
  return portrait?.compactFace ?? '(?_?)'
}

/**
 * Render a guardian sprite for terminal display.
 *
 * For iTerm2/Kitty terminals: returns inline image escape sequence
 * For basic terminals: returns ASCII art from sprite-atlas
 *
 * @param masterId - The master's ID (e.g., 'warren_buffett', 'ghost_sbf')
 * @param emotion - The emotion state to display
 * @param size - Display size: 'large' (10 rows), 'small' (5 rows), 'avatar' (3 rows)
 * @returns The rendered sprite string (may contain escape sequences)
 */
export function renderSprite(
  masterId: string,
  emotion: Emotion | string = 'neutral',
  size: SpriteSize = 'small',
): string {
  const protocol = getImageProtocol()
  const rows = SIZE_TO_ROWS[size]
  const cols = SIZE_TO_COLS[size]

  if (protocol !== 'none') {
    // Try to load and render the PNG sprite
    const spritePath = getSpritePath(masterId, emotion)
    try {
      if (fs.existsSync(spritePath)) {
        const pngData = fs.readFileSync(spritePath)
        if (protocol === 'iterm2') {
          return renderITerm2(pngData, rows, cols)
        }
        if (protocol === 'kitty') {
          return renderKitty(pngData, rows, cols)
        }
      }
    } catch {
      // Fall through to ASCII fallback
    }
  }

  // ASCII art fallback
  const normalizedEmotion = (['neutral', 'happy', 'worried', 'stern'].includes(emotion)
    ? emotion
    : 'neutral') as Emotion

  if (size === 'avatar') {
    return getCompactFace(masterId)
  }

  return getAsciiFallback(masterId, normalizedEmotion)
}
