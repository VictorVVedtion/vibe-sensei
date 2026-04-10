/**
 * Generate a composite grid image of all 68 guardian master idle sprites.
 * Output: assets/master-roster.png
 *
 * Usage: bun run scripts/generate-sprite-grid.ts
 */

import sharp from 'sharp'
import { existsSync } from 'fs'
import { join } from 'path'

// ---------------------------------------------------------------------------
// Data — mirrors src/buddy/types.ts
// ---------------------------------------------------------------------------

type Rarity = 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common'

const RARITY_COLORS: Record<Rarity, string> = {
  legendary: '#FFD700',
  epic: '#9B59B6',
  rare: '#3498DB',
  uncommon: '#2ECC71',
  common: '#95A5A6',
}

interface MasterEntry {
  key: string
  name: string
  rarity: Rarity
}

const MASTERS: MasterEntry[] = [
  // Western Trading Legends
  { key: 'jesse_livermore', name: 'Jesse Livermore', rarity: 'legendary' },
  { key: 'george_soros', name: 'George Soros', rarity: 'legendary' },
  { key: 'paul_tudor_jones', name: 'Paul Tudor Jones', rarity: 'epic' },
  { key: 'stanley_druckenmiller', name: 'S. Druckenmiller', rarity: 'epic' },
  { key: 'michael_burry', name: 'Michael Burry', rarity: 'epic' },
  { key: 'john_paulson', name: 'John Paulson', rarity: 'rare' },
  { key: 'nicolas_darvas', name: 'Nicolas Darvas', rarity: 'uncommon' },
  // Value Investing Sages
  { key: 'warren_buffett', name: 'Warren Buffett', rarity: 'legendary' },
  { key: 'benjamin_graham', name: 'Benjamin Graham', rarity: 'legendary' },
  { key: 'charlie_munger', name: 'Charlie Munger', rarity: 'epic' },
  { key: 'ray_dalio', name: 'Ray Dalio', rarity: 'epic' },
  { key: 'john_templeton', name: 'John Templeton', rarity: 'rare' },
  // Quant/Systematic Pioneers
  { key: 'jim_simons', name: 'Jim Simons', rarity: 'legendary' },
  { key: 'ed_thorp', name: 'Ed Thorp', rarity: 'epic' },
  { key: 'richard_dennis', name: 'Richard Dennis', rarity: 'rare' },
  { key: 'linda_raschke', name: 'Linda Raschke', rarity: 'uncommon' },
  // Eastern Strategists
  { key: 'sun_tzu', name: 'Sun Tzu', rarity: 'legendary' },
  { key: 'munehisa_homma', name: 'Homma', rarity: 'epic' },
  { key: 'fan_li', name: 'Fan Li', rarity: 'rare' },
  { key: 'miyamoto_musashi', name: 'Musashi', rarity: 'epic' },
  { key: 'lv_buwei', name: 'Lv Buwei', rarity: 'rare' },
  // Philosophers of Risk
  { key: 'nassim_taleb', name: 'Nassim Taleb', rarity: 'epic' },
  { key: 'seneca', name: 'Seneca', rarity: 'rare' },
  { key: 'laozi', name: 'Laozi', rarity: 'rare' },
  { key: 'machiavelli', name: 'Machiavelli', rarity: 'uncommon' },
  // Crypto Era
  { key: 'satoshi_nakamoto', name: 'Satoshi Nakamoto', rarity: 'legendary' },
  { key: 'arthur_hayes', name: 'Arthur Hayes', rarity: 'uncommon' },
  // Tactical/Specialist
  { key: 'william_oneil', name: "William O'Neil", rarity: 'common' },
  { key: 'victor_sperandeo', name: 'V. Sperandeo', rarity: 'uncommon' },
  { key: 'larry_williams', name: 'Larry Williams', rarity: 'uncommon' },
  // First Principles / Tech Visionaries
  { key: 'elon_musk', name: 'Elon Musk', rarity: 'epic' },
  { key: 'jeff_bezos', name: 'Jeff Bezos', rarity: 'rare' },
  { key: 'peter_thiel', name: 'Peter Thiel', rarity: 'epic' },
  { key: 'steve_jobs', name: 'Steve Jobs', rarity: 'rare' },
  { key: 'richard_feynman', name: 'Richard Feynman', rarity: 'rare' },
  { key: 'garry_tan', name: 'Garry Tan', rarity: 'epic' },
  { key: 'andrej_karpathy', name: 'A. Karpathy', rarity: 'epic' },
  // Chinese Business Legends
  { key: 'li_ka_shing', name: 'Li Ka-shing', rarity: 'epic' },
  { key: 'hu_xueyan', name: 'Hu Xueyan', rarity: 'rare' },
  { key: 'zong_qinghou', name: 'Zong Qinghou', rarity: 'uncommon' },
  { key: 'zeng_guofan', name: 'Zeng Guofan', rarity: 'rare' },
  { key: 'bai_gui', name: 'Bai Gui', rarity: 'rare' },
  { key: 'shen_wansan', name: 'Shen Wansan', rarity: 'uncommon' },
  { key: 'zhang_jian', name: 'Zhang Jian', rarity: 'uncommon' },
  // Crypto/Web3 Extended
  { key: 'vitalik_buterin', name: 'Vitalik Buterin', rarity: 'epic' },
  { key: 'cz_zhao', name: 'CZ', rarity: 'rare' },
  { key: 'andre_cronje', name: 'Andre Cronje', rarity: 'uncommon' },
  { key: 'he_yi', name: 'He Yi', rarity: 'rare' },
  { key: 'xu_mingxing', name: 'Xu Mingxing', rarity: 'uncommon' },
  { key: 'justin_sun', name: 'Justin Sun', rarity: 'uncommon' },
  { key: 'brian_armstrong', name: 'B. Armstrong', rarity: 'uncommon' },
  { key: 'barry_silbert', name: 'Barry Silbert', rarity: 'uncommon' },
  { key: 'michael_saylor', name: 'Michael Saylor', rarity: 'rare' },
  // Crypto Degen Legends
  { key: 'liangxi', name: 'Liangxi', rarity: 'rare' },
  // Crypto Cautionary Veterans
  { key: 'do_kwon', name: 'Do Kwon', rarity: 'uncommon' },
  { key: 'su_zhu', name: 'Su Zhu', rarity: 'uncommon' },
  { key: 'sbf', name: 'SBF', rarity: 'uncommon' },
  { key: 'kyle_davies', name: 'Kyle Davies', rarity: 'uncommon' },
  // US Macro / Regulators
  { key: 'powell', name: 'Jerome Powell', rarity: 'rare' },
  { key: 'yellen', name: 'Janet Yellen', rarity: 'rare' },
  { key: 'gary_gensler', name: 'Gary Gensler', rarity: 'uncommon' },
  // Innovation / Disruption
  { key: 'cathie_wood', name: 'Cathie Wood', rarity: 'rare' },
  // Scientists/Mathematicians
  { key: 'isaac_newton', name: 'Isaac Newton', rarity: 'rare' },
  { key: 'albert_einstein', name: 'A. Einstein', rarity: 'rare' },
  { key: 'alan_turing', name: 'Alan Turing', rarity: 'epic' },
  { key: 'carl_gauss', name: 'Carl Gauss', rarity: 'rare' },
  { key: 'benoit_mandelbrot', name: 'B. Mandelbrot', rarity: 'epic' },
  { key: 'claude_shannon', name: 'C. Shannon', rarity: 'epic' },
  { key: 'john_von_neumann', name: 'von Neumann', rarity: 'legendary' },
]

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const COLS = 9
const ROWS = 8
const CELL_SIZE = 128
const BORDER_WIDTH = 2
const SPRITE_AREA = CELL_SIZE - BORDER_WIDTH * 2 // inner area for sprite
const NAME_HEIGHT = 16 // space for name text below sprite
const SPRITE_HEIGHT = SPRITE_AREA - NAME_HEIGHT // sprite image area

const TITLE_BAR_HEIGHT = 48
const GRID_WIDTH = COLS * CELL_SIZE
const GRID_HEIGHT = ROWS * CELL_SIZE
const CANVAS_WIDTH = GRID_WIDTH
const CANVAS_HEIGHT = TITLE_BAR_HEIGHT + GRID_HEIGHT

const BG_COLOR = '#0D0D0D'
const TITLE_BG = '#111111'
const PLACEHOLDER_BG = '#1A1A1A'

const SPRITES_DIR = join(import.meta.dir, '..', 'assets', 'sprites')
const OUTPUT_PATH = join(import.meta.dir, '..', 'assets', 'master-roster.png')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join('')
}

async function createPlaceholderCell(
  initials: string,
  rarity: Rarity,
): Promise<Buffer> {
  const borderColor = RARITY_COLORS[rarity]
  const inner = CELL_SIZE - BORDER_WIDTH * 2

  // Gray placeholder with initials via SVG text overlay
  const svg = `<svg width="${inner}" height="${inner}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${inner}" height="${inner}" fill="${PLACEHOLDER_BG}"/>
    <text x="${inner / 2}" y="${inner / 2 - 4}" font-family="monospace" font-size="28"
          font-weight="bold" fill="#555" text-anchor="middle" dominant-baseline="central">
      ${initials}
    </text>
    <text x="${inner / 2}" y="${inner - 6}" font-family="monospace" font-size="7"
          fill="#444" text-anchor="middle">NO SPRITE</text>
  </svg>`

  const innerImg = await sharp(Buffer.from(svg)).png().toBuffer()

  // Wrap with rarity border
  return sharp({
    create: {
      width: CELL_SIZE,
      height: CELL_SIZE,
      channels: 4,
      background: borderColor,
    },
  })
    .composite([{ input: innerImg, left: BORDER_WIDTH, top: BORDER_WIDTH }])
    .png()
    .toBuffer()
}

async function createSpriteCell(
  spritePath: string,
  name: string,
  rarity: Rarity,
): Promise<Buffer> {
  const borderColor = RARITY_COLORS[rarity]
  const inner = CELL_SIZE - BORDER_WIDTH * 2

  // Resize sprite to fit within the inner area (leave room for name)
  const spriteImg = await sharp(spritePath)
    .resize(inner, SPRITE_HEIGHT, { fit: 'contain', background: BG_COLOR })
    .png()
    .toBuffer()

  // Truncate name to fit
  const displayName = name.length > 14 ? name.slice(0, 13) + '.' : name

  // Name label SVG
  const nameSvg = `<svg width="${inner}" height="${NAME_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${inner}" height="${NAME_HEIGHT}" fill="${BG_COLOR}"/>
    <text x="${inner / 2}" y="${NAME_HEIGHT - 3}" font-family="monospace" font-size="9"
          fill="#CCCCCC" text-anchor="middle">${escapeXml(displayName)}</text>
  </svg>`

  const nameImg = await sharp(Buffer.from(nameSvg)).png().toBuffer()

  // Compose: border bg -> sprite -> name
  return sharp({
    create: {
      width: CELL_SIZE,
      height: CELL_SIZE,
      channels: 4,
      background: borderColor,
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: inner,
            height: inner,
            channels: 4,
            background: BG_COLOR,
          },
        })
          .composite([
            { input: spriteImg, left: 0, top: 0 },
            { input: nameImg, left: 0, top: SPRITE_HEIGHT },
          ])
          .png()
          .toBuffer(),
        left: BORDER_WIDTH,
        top: BORDER_WIDTH,
      },
    ])
    .png()
    .toBuffer()
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ---------------------------------------------------------------------------
// Title bar
// ---------------------------------------------------------------------------

async function createTitleBar(): Promise<Buffer> {
  const svg = `<svg width="${CANVAS_WIDTH}" height="${TITLE_BAR_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${CANVAS_WIDTH}" height="${TITLE_BAR_HEIGHT}" fill="${TITLE_BG}"/>
    <text x="${CANVAS_WIDTH / 2}" y="${TITLE_BAR_HEIGHT / 2 + 2}" font-family="monospace"
          font-size="18" font-weight="bold" fill="#FFFFFF" text-anchor="middle"
          dominant-baseline="central">VIBE SENSEI — ${MASTERS.length} GUARDIAN MASTERS</text>
    <line x1="0" y1="${TITLE_BAR_HEIGHT - 1}" x2="${CANVAS_WIDTH}" y2="${TITLE_BAR_HEIGHT - 1}"
          stroke="#FFD700" stroke-width="2"/>
  </svg>`

  return sharp(Buffer.from(svg)).png().toBuffer()
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`Generating sprite grid for ${MASTERS.length} masters...`)
  console.log(`Layout: ${COLS}x${ROWS} = ${COLS * ROWS} cells (${MASTERS.length} filled)`)
  console.log(`Canvas: ${CANVAS_WIDTH}x${CANVAS_HEIGHT}px`)

  const composites: sharp.OverlayOptions[] = []

  // Title bar
  const titleBar = await createTitleBar()
  composites.push({ input: titleBar, left: 0, top: 0 })

  // Build each cell
  let spriteCount = 0
  let placeholderCount = 0

  for (let i = 0; i < MASTERS.length; i++) {
    const master = MASTERS[i]!
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const x = col * CELL_SIZE
    const y = TITLE_BAR_HEIGHT + row * CELL_SIZE

    const spritePath = join(SPRITES_DIR, `${master.key}-idle.png`)
    const hasSprite = existsSync(spritePath)

    let cellBuffer: Buffer

    if (hasSprite) {
      cellBuffer = await createSpriteCell(spritePath, master.name, master.rarity)
      spriteCount++
    } else {
      const initials = getInitials(master.name)
      cellBuffer = await createPlaceholderCell(initials, master.rarity)
      placeholderCount++
    }

    composites.push({ input: cellBuffer, left: x, top: y })
  }

  // Fill remaining empty cells with dark background
  for (let i = MASTERS.length; i < COLS * ROWS; i++) {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const x = col * CELL_SIZE
    const y = TITLE_BAR_HEIGHT + row * CELL_SIZE

    const emptySvg = `<svg width="${CELL_SIZE}" height="${CELL_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${CELL_SIZE}" height="${CELL_SIZE}" fill="${BG_COLOR}"/>
    </svg>`
    const emptyCell = await sharp(Buffer.from(emptySvg)).png().toBuffer()
    composites.push({ input: emptyCell, left: x, top: y })
  }

  // Composite everything onto the canvas
  const output = await sharp({
    create: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toBuffer()

  await Bun.write(OUTPUT_PATH, output)

  console.log(`\nDone!`)
  console.log(`  Sprites found: ${spriteCount}`)
  console.log(`  Placeholders:  ${placeholderCount}`)
  console.log(`  Output: ${OUTPUT_PATH}`)
  console.log(`  Size: ${(output.length / 1024).toFixed(1)} KB`)
}

main().catch((err) => {
  console.error('Failed to generate sprite grid:', err)
  process.exit(1)
})
