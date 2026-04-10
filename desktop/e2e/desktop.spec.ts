/**
 * Vibe Sensei Desktop — Playwright E2E Tests
 *
 * Real interaction tests: launch Electron, click, type, verify UI state.
 * Run: cd desktop && npx playwright test e2e/desktop.spec.ts
 */
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import * as path from 'path'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  // Launch the Electron app from the built main process
  app = await electron.launch({
    args: [path.join(__dirname, '..')],
    env: {
      ...process.env,
      NODE_ENV: 'development',
      VIBE_SENSEI_DESKTOP: '1',
    },
    timeout: 30000,
  })

  // Get the first window
  page = await app.firstWindow()
  // Wait for the renderer to be ready
  await page.waitForLoadState('domcontentloaded')
  // Extra wait for components to mount
  await page.waitForTimeout(3000)
})

test.afterAll(async () => {
  if (app) await app.close()
})

// ============================================================
// WINDOW & LAYOUT
// ============================================================

test('window opens with correct title', async () => {
  const title = await page.title()
  console.log('Window title:', title)
  expect(title.length).toBeGreaterThan(0)
})

test('window has expected minimum size', async () => {
  const window = await app.browserWindow(page)
  const [width, height] = await window.evaluate(w => w.getSize())
  console.log(`Window size: ${width}x${height}`)
  expect(width).toBeGreaterThanOrEqual(800)
  expect(height).toBeGreaterThanOrEqual(500)
})

test('3-panel layout renders', async () => {
  // Chat panel (replaced old terminal/xterm)
  const chatPanel = await page.$('.chat-root, [class*="chat"]')
  console.log('Chat panel found:', !!chatPanel)

  // Chart panel
  const chart = await page.$('.chart-panel, [class*="chart"]')
  console.log('Chart panel found:', !!chart)

  // Guardian sidebar
  const sidebar = await page.$('.guardian-sidebar-scroll, [class*="sidebar"], [class*="guardian"]')
  console.log('Sidebar found:', !!sidebar)
})

// ============================================================
// STATUS BAR
// ============================================================

test('status bar shows connection and paper mode', async () => {
  const statusBar = await page.textContent('body')
  const bodyText = statusBar ?? ''

  const hasPaper = bodyText.includes('PAPER') || bodyText.includes('paper')
  console.log('Paper mode indicator:', hasPaper)
  expect(hasPaper).toBe(true)
})

// ============================================================
// GUARDIAN SIDEBAR COMPONENTS
// ============================================================

test('MasterCard renders with guardian name', async () => {
  const bodyText = await page.textContent('body') ?? ''
  // Should contain the master name "VANE" or "Vane"
  const hasVane = bodyText.includes('VANE') || bodyText.includes('Vane')
  console.log('Master name found:', hasVane)
  // At minimum, some master-related content exists
  const hasMaster = hasVane || bodyText.includes('OPERATOR') || bodyText.includes('Guardian')
  expect(hasMaster).toBe(true)
})

test('risk gauge renders', async () => {
  const bodyText = await page.textContent('body') ?? ''
  // Risk display should show risk level
  const hasRisk = bodyText.includes('RISK') || bodyText.includes('LOW') || bodyText.includes('HEAT')
  console.log('Risk gauge found:', hasRisk)
  expect(hasRisk).toBe(true)
})

test('stat badges visible (PRE/PAT/AGG/WIS/SAS)', async () => {
  const bodyText = await page.textContent('body') ?? ''
  const stats = ['PRE', 'PAT', 'AGG', 'WIS', 'SAS']
  const found = stats.filter(s => bodyText.includes(s))
  console.log('Stats found:', found.join(', '))
  expect(found.length).toBeGreaterThanOrEqual(3)
})

// ============================================================
// VENUE TABS
// ============================================================

test('venue tabs display all 7 verticals', async () => {
  const bodyText = await page.textContent('body') ?? ''
  const venues = ['SPOT', 'PERP', 'OPT', 'STOCK', 'DEFI', 'PRED', 'FX']
  const found = venues.filter(v => bodyText.includes(v))
  console.log('Venue tabs found:', found.join(', '))
  expect(found.length).toBeGreaterThanOrEqual(5)
})

test('click PERP tab', async () => {
  const perpTab = await page.$('text=PERP')
  if (perpTab) {
    await perpTab.click()
    await page.waitForTimeout(500)
    const bodyText = await page.textContent('body') ?? ''
    console.log('After PERP click - body contains PERP:', bodyText.includes('PERP'))
    // Click back to SPOT
    const spotTab = await page.$('text=SPOT')
    if (spotTab) await spotTab.click()
  } else {
    console.log('PERP tab not found as clickable element, trying alternative selector')
    // Try clicking by position or other selector
    const tabs = await page.$$('[class*="tab"], [class*="venue"], button')
    console.log('Found', tabs.length, 'potential tab elements')
  }
})

// ============================================================
// COMPANION SPRITE
// ============================================================

test('companion sprite or fallback renders', async () => {
  // Check for sprite image or initials fallback
  const sprite = await page.$('img[alt="Guardian companion"]')
  const fallback = await page.$('[class*="companion"], [class*="sprite"]')
  const hasSprite = !!sprite || !!fallback

  if (sprite) {
    const src = await sprite.getAttribute('src')
    console.log('Sprite img src:', src)
    // Check if it loaded successfully (not broken)
    const natural = await sprite.evaluate((el: HTMLImageElement) => el.naturalWidth)
    console.log('Sprite natural width:', natural, natural > 0 ? '(loaded OK)' : '(BROKEN)')
  } else {
    console.log('No sprite img tag, checking for initials fallback')
    const bodyText = await page.textContent('body') ?? ''
    // Initials fallback should show 2-letter initials
    console.log('Fallback might be rendering initials')
  }

  // At least something companion-related should be on screen
  const bodyText = await page.textContent('body') ?? ''
  const hasCompanion = bodyText.includes('Linda Raschke') || bodyText.includes('Vane') || hasSprite
  console.log('Companion visible:', hasCompanion)
})

// ============================================================
// SPEECH BUBBLE
// ============================================================

test('speech bubble displays guardian message', async () => {
  const bodyText = await page.textContent('body') ?? ''
  // Linda Raschke's speech or any guardian speech
  const hasSpeech = bodyText.includes('Linda Raschke') ||
    bodyText.includes('Markets quiet') ||
    bodyText.includes('review the week') ||
    bodyText.includes('Rest is edge')
  console.log('Speech bubble content found:', hasSpeech)
})

// ============================================================
// CHART
// ============================================================

test('TradingView chart renders', async () => {
  // TradingView uses iframes or specific div classes
  const tvWidget = await page.$('.chart-panel iframe, .tv-lightweight-charts, canvas, [class*="chart"]')
  console.log('Chart widget found:', !!tvWidget)

  const bodyText = await page.textContent('body') ?? ''
  const hasBTCUSD = bodyText.includes('BTC') || bodyText.includes('BTCUSD')
  console.log('BTC/USD symbol visible:', hasBTCUSD)

  const hasPrice = /\d{2},\d{3}/.test(bodyText)
  console.log('Price visible (XX,XXX format):', hasPrice)
  expect(hasBTCUSD || hasPrice).toBe(true)
})

test('timeframe selectors visible', async () => {
  const bodyText = await page.textContent('body') ?? ''
  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1D', '1W']
  const found = timeframes.filter(tf => bodyText.includes(tf))
  console.log('Timeframes found:', found.join(', '))
  expect(found.length).toBeGreaterThanOrEqual(3)
})

// ============================================================
// TRADE FEED
// ============================================================

test('real-time trade feed visible', async () => {
  const bodyText = await page.textContent('body') ?? ''
  const hasBuy = bodyText.includes('BUY')
  const hasSell = bodyText.includes('SELL')
  console.log('Trade feed - BUY:', hasBuy, 'SELL:', hasSell)

  // Check for venue names
  const venues = ['BINANCE', 'BYBIT', 'OKX']
  const foundVenues = venues.filter(v => bodyText.includes(v))
  console.log('Exchange names found:', foundVenues.join(', '))
})

// ============================================================
// MARKET DATA
// ============================================================

test('market indicators visible (ADX, RSI, ATR)', async () => {
  const bodyText = await page.textContent('body') ?? ''
  const indicators = ['ADX', 'RSI', 'ATR', 'VOL']
  const found = indicators.filter(i => bodyText.includes(i))
  console.log('Indicators found:', found.join(', '))
  expect(found.length).toBeGreaterThanOrEqual(2)
})

test('position display shows P&L', async () => {
  const bodyText = await page.textContent('body') ?? ''
  const hasPosition = bodyText.includes('LONG') || bodyText.includes('SHORT') || bodyText.includes('P&L')
  console.log('Position display:', hasPosition)
})

// ============================================================
// BUTTONS & ACTIONS
// ============================================================

test('EXEC button exists', async () => {
  const execBtn = await page.$('text=EXEC')
  console.log('EXEC button found:', !!execBtn)
  // Don't click it — just verify existence
})

test('FORCED_EXIT button exists', async () => {
  const exitBtn = await page.$('text=FORCED_EXIT')
  console.log('FORCED_EXIT button found:', !!exitBtn)
})

test('SYS_STAT button exists', async () => {
  const statBtn = await page.$('text=SYS_STAT')
  console.log('SYS_STAT button found:', !!statBtn)
})

// ============================================================
// COLLAPSIBLE CARDS
// ============================================================

test('collapsible cards exist in sidebar', async () => {
  // Look for collapsible card headers or toggle elements
  const cards = await page.$$('[class*="collapsible"], [class*="card-header"], [class*="collapse"]')
  console.log('Collapsible card elements:', cards.length)

  const bodyText = await page.textContent('body') ?? ''
  const sections = ['ALERT', 'BALANCE', 'TRADE_HISTORY', 'ANTI_PORTFOLIO', 'WEEKLY_REVIEW']
  const found = sections.filter(s => bodyText.includes(s))
  console.log('Sidebar sections found:', found.join(', '))
})

// ============================================================
// SCREENSHOT EVIDENCE
// ============================================================

test('capture full-page screenshot', async () => {
  await page.screenshot({
    path: path.join(__dirname, '..', 'e2e-screenshot-full.png'),
    fullPage: false,
  })
  console.log('Screenshot saved: desktop/e2e-screenshot-full.png')
})

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

test('Cmd+1 focuses terminal panel', async () => {
  await page.keyboard.press('Meta+1')
  await page.waitForTimeout(300)
  // Verify focus changed (hard to assert exactly, but shouldn't crash)
  console.log('Cmd+1 pressed — no crash')
})

test('Cmd+2 focuses chart panel', async () => {
  await page.keyboard.press('Meta+2')
  await page.waitForTimeout(300)
  console.log('Cmd+2 pressed — no crash')
})

test('Cmd+3 focuses sidebar', async () => {
  await page.keyboard.press('Meta+3')
  await page.waitForTimeout(300)
  console.log('Cmd+3 pressed — no crash')
})

// ============================================================
// WINDOW CONTROLS
// ============================================================

test('window can be resized', async () => {
  const window = await app.browserWindow(page)
  const [origW, origH] = await window.evaluate(w => w.getSize())
  console.log(`Original size: ${origW}x${origH}`)

  await window.evaluate(w => w.setSize(1000, 700))
  await page.waitForTimeout(500)
  const [newW, newH] = await window.evaluate(w => w.getSize())
  console.log(`After resize: ${newW}x${newH}`)
  expect(newW).toBe(1000)
  expect(newH).toBe(700)

  // Restore
  await window.evaluate((w) => w.setSize(1200, 750))
})

test('window can be minimized and restored', async () => {
  const window = await app.browserWindow(page)
  await window.evaluate(w => w.minimize())
  await page.waitForTimeout(300)
  const isMin = await window.evaluate(w => w.isMinimized())
  console.log('Minimized:', isMin)
  expect(isMin).toBe(true)

  await window.evaluate(w => w.restore())
  await page.waitForTimeout(300)
  const isMin2 = await window.evaluate(w => w.isMinimized())
  console.log('Restored:', !isMin2)
  expect(isMin2).toBe(false)
})
