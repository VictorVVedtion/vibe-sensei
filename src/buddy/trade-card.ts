/**
 * Trade Card Generator — produces shareable text cards for Twitter/X.
 * Formats trade entries with guardian persona, risk/reward metrics,
 * and box-drawing art into copy-paste-ready cards.
 */

import type { Rarity } from './types.js'
import { RARITY_STARS } from './types.js'
import type { TradeReport } from './trade-report.js'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TradeCardInput {
  symbol: string          // "BTC/USDT"
  side: 'buy' | 'sell'
  price: number           // entry price
  quantity: number
  masterName: string      // "Warren Buffett"
  masterRarity: string    // "★★★★★"
  thesis?: string         // AI-generated 1-liner (optional)
  stopLoss?: number       // stop loss price
  takeProfit?: number     // take profit price
}

// ─── Number Formatting ───────────────────────────────────────────────────────

/**
 * Formats a number with commas and appropriate decimal precision.
 * Prices >= 1 get 2 decimals; prices < 1 get up to 6 significant decimals.
 */
function formatPrice(value: number): string {
  if (value >= 1) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
  const decimals = Math.max(2, Math.min(6, -Math.floor(Math.log10(value)) + 2))
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Formats a quantity value — uses up to 8 decimals for fractional amounts.
 */
function formatQuantity(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString('en-US')
  const decimals = Math.min(8, String(value).split('.')[1]?.length ?? 2)
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: decimals,
  })
}

// ─── Box Drawing ─────────────────────────────────────────────────────────────

const MIN_CARD_WIDTH = 35

/**
 * Calculates the visual display width of a string in a monospace terminal.
 * Emoji and CJK characters occupy 2 columns; ANSI escapes occupy 0.
 */
function displayWidth(str: string): number {
  const clean = stripAnsi(str)
  let width = 0
  for (const char of clean) {
    const code = char.codePointAt(0) ?? 0
    if (code > 0xFFFF) { width += 2; continue }
    if (
      (code >= 0x2E80 && code <= 0x9FFF) ||
      (code >= 0xF900 && code <= 0xFAFF) ||
      (code >= 0xFE30 && code <= 0xFE4F) ||
      (code >= 0xFF01 && code <= 0xFF60) ||
      (code >= 0xFFE0 && code <= 0xFFE6) ||
      code === 0x26A1
    ) { width += 2; continue }
    if (
      (code >= 0xFE00 && code <= 0xFE0F) ||
      code === 0x200D || code === 0x20E3
    ) { continue }
    width += 1
  }
  return width
}

/**
 * Pads a content line to a target inner width inside box borders.
 */
function padLine(content: string, innerWidth: number): string {
  const visWidth = displayWidth(content)
  const padding = Math.max(0, innerWidth - visWidth)
  return `\u2502  ${content}${' '.repeat(padding)} \u2502`
}

/**
 * Creates an empty line inside the card with given total card width.
 */
function emptyLine(cardWidth: number): string {
  return `\u2502${' '.repeat(cardWidth - 2)}\u2502`
}

/**
 * Strips ANSI escape codes for accurate length calculation.
 */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '')
}

/**
 * Truncates a string to fit within a given display width, adding "..." if cut.
 */
function truncateToWidth(str: string, maxWidth: number): string {
  if (displayWidth(str) <= maxWidth) return str
  let result = ''
  let width = 0
  for (const char of str) {
    const charWidth = displayWidth(char)
    if (width + charWidth > maxWidth - 3) break
    result += char
    width += charWidth
  }
  return result + '...'
}

// ─── Risk / Reward ───────────────────────────────────────────────────────────

/**
 * Calculates risk:reward ratio from entry, stop loss, and take profit.
 * Returns formatted string like "1:3.2" or "N/A" if inputs are invalid.
 */
export function calculateRiskReward(
  entry: number,
  stopLoss: number,
  takeProfit: number,
): string {
  const risk = Math.abs(entry - stopLoss)
  const reward = Math.abs(takeProfit - entry)
  if (risk === 0 || !Number.isFinite(risk) || !Number.isFinite(reward)) {
    return 'N/A'
  }
  const ratio = reward / risk
  return `1:${ratio.toFixed(1)}`
}

// ─── Card Generator ──────────────────────────────────────────────────────────

/**
 * Generates a formatted trade card for sharing on Twitter/X.
 * Card width adapts to the widest content line.
 */
export function generateTradeCard(trade: TradeCardInput): string {
  const sideEmoji = trade.side === 'buy' ? '\u{1F7E2}' : '\u{1F534}'
  const sideLabel = trade.side.toUpperCase()
  const formattedPrice = formatPrice(trade.price)
  const baseCurrency = trade.symbol.split('/')[0] ?? trade.symbol
  const notional = trade.price * trade.quantity
  const formattedQty = formatQuantity(trade.quantity)
  const formattedNotional = formatPrice(notional)

  // Build content lines first to measure widths
  const contentLines = buildContentLines(
    trade, sideEmoji, sideLabel, formattedPrice,
    baseCurrency, formattedQty, formattedNotional,
  )

  // Card width = widest line + 5 (for "│  " prefix and " │" suffix)
  const maxContent = contentLines.reduce((m, c) => Math.max(m, displayWidth(c)), 0)
  const cardWidth = Math.max(MIN_CARD_WIDTH, maxContent + 5)
  const innerWidth = cardWidth - 5

  const lines: string[] = []
  lines.push(`\u250C${'─'.repeat(cardWidth - 2)}\u2510`)
  for (const content of contentLines) {
    if (content === '') {
      lines.push(emptyLine(cardWidth))
    } else {
      lines.push(padLine(content, innerWidth))
    }
  }
  lines.push(`\u2514${'─'.repeat(cardWidth - 2)}\u2518`)

  return lines.join('\n')
}

/**
 * Assembles the inner content lines for the trade card.
 * Empty strings represent spacer lines.
 */
function buildContentLines(
  trade: TradeCardInput,
  sideEmoji: string, sideLabel: string, formattedPrice: string,
  baseCurrency: string, formattedQty: string, formattedNotional: string,
): string[] {
  const content: string[] = []

  content.push(`${sideEmoji} ${sideLabel}  ${trade.symbol} @ $${formattedPrice}`)
  content.push(`Qty: ${formattedQty} ${baseCurrency} ($${formattedNotional})`)
  content.push('')  // spacer

  content.push(`Guardian: ${trade.masterName} ${trade.masterRarity}`)

  if (trade.thesis) {
    const maxWidth = 40  // reasonable thesis width before truncation
    const truncated = truncateToWidth(trade.thesis, maxWidth)
    content.push(`\u201C${truncated}\u201D`)
  }

  content.push('')  // spacer

  const hasSl = trade.stopLoss !== undefined && trade.stopLoss !== null
  const hasTp = trade.takeProfit !== undefined && trade.takeProfit !== null
  if (hasSl || hasTp) {
    const slStr = hasSl ? `SL: $${formatPrice(trade.stopLoss!)}` : 'SL: ---'
    const tpStr = hasTp ? `TP: $${formatPrice(trade.takeProfit!)}` : 'TP: ---'
    content.push(`${slStr} | ${tpStr}`)

    if (hasSl && hasTp) {
      const rr = calculateRiskReward(trade.price, trade.stopLoss!, trade.takeProfit!)
      content.push(`R:R  ${rr}`)
    }

    content.push('')  // spacer
  }

  content.push('\u26A1 vibe-sensei')
  return content
}

// ─── Clipboard Export ────────────────────────────────────────────────────────

/**
 * Strips box-drawing characters for plain text clipboard copy.
 * Adds "Generated by vibe-sensei" footer.
 */
export function formatCardForClipboard(card: string): string {
  const stripped = card
    .replace(/[┌┐└┘│─]/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')

  return `${stripped}\n\nGenerated by vibe-sensei`
}

// ─── Convenience: Build from Rarity Key ──────────────────────────────────────

/**
 * Resolves a Rarity key to its star string.
 * Convenience for callers that have a Rarity enum instead of pre-formatted stars.
 */
export function rarityToStars(rarity: Rarity): string {
  return RARITY_STARS[rarity]
}

// ─── Trade Report Card ──────────────────────────────────────────────────────

/**
 * Generates a shareable trade report card with box-drawing art.
 * Shows completed trade metrics: P&L, R-multiple, MAE/MFE, efficiency.
 */
export function generateTradeReportCard(report: TradeReport): string {
  const contentLines = buildReportCardLines(report)

  const maxContent = contentLines.reduce(
    (m, c) => Math.max(m, displayWidth(c)), 0,
  )
  const cardWidth = Math.max(MIN_CARD_WIDTH, maxContent + 5)
  const innerWidth = cardWidth - 5

  const lines: string[] = []
  lines.push(`\u250C${'─'.repeat(cardWidth - 2)}\u2510`)
  for (const content of contentLines) {
    if (content === '') {
      lines.push(emptyLine(cardWidth))
    } else {
      lines.push(padLine(content, innerWidth))
    }
  }
  lines.push(`\u2514${'─'.repeat(cardWidth - 2)}\u2518`)

  return lines.join('\n')
}

/**
 * Builds inner content lines for a trade report card.
 */
function buildReportCardLines(report: TradeReport): string[] {
  const content: string[] = []
  const side = report.side === 'buy' ? 'LONG' : 'SHORT'
  const pnlSign = report.netPnL >= 0 ? '+' : ''
  const pctSign = report.netPnLPercent >= 0 ? '+' : ''
  const resultIcon = report.netPnL >= 0 ? '\u{1F7E2}' : '\u{1F534}'

  content.push(
    `${resultIcon} ${report.symbol} ${side} CLOSED`,
  )
  content.push('')

  const pnlStr = `${pnlSign}$${formatReportPrice(report.netPnL)}`
  const pctStr = `${pctSign}${report.netPnLPercent.toFixed(2)}%`
  content.push(`P&L: ${pnlStr} (${pctStr})`)

  content.push(
    `Entry: $${formatReportPrice(report.entryPrice)} | Exit: $${formatReportPrice(report.exitPrice)}`,
  )

  const qty = formatReportQty(report.quantity)
  const baseCurrency = report.symbol.split('/')[0] ?? report.symbol
  content.push(`Qty: ${qty} ${baseCurrency}`)
  content.push('')

  const rStr = `${report.rMultiple.toFixed(2)}R`
  content.push(`R-Multiple: ${rStr}`)
  content.push(`Hold: ${report.holdDurationHuman}`)
  content.push('')

  const maeStr = `${report.mae.toFixed(2)}%`
  const mfeStr = `+${Math.abs(report.mfe).toFixed(2)}%`
  content.push(`MAE: ${maeStr} | MFE: ${mfeStr}`)
  content.push(`Efficiency: ${report.efficiencyRatio}%`)
  content.push('')

  content.push('\u26A1 vibe-sensei')
  return content
}

function formatReportPrice(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
  if (abs === 0) return '0.00'
  const d = Math.max(2, Math.min(6, -Math.floor(Math.log10(abs)) + 2))
  return value.toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

function formatReportQty(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString('en-US')
  const decimals = Math.min(8, String(value).split('.')[1]?.length ?? 2)
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: decimals,
  })
}
