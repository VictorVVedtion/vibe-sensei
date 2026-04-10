/**
 * Trading context builder: generates a concise markdown summary of the
 * current trading state for injection into the AI system prompt.
 *
 * Output is capped at ~2000 chars (~500 tokens) so it fits comfortably
 * inside the context window without crowding other instructions.
 */

import { getConnectedExchange } from './exchange/singleton.js'
import type { Balance, ExchangeInterface, Position } from './exchange/types.js'
import { getCompanion, getMasterName } from '../buddy/companion.js'
import { RARITY_STARS } from '../buddy/types.js'
import { calculatePortfolioHeat } from './portfolio/heat-calculator.js'
import { getLatestRegime } from './market/regime.js'
import { sanitizeShortString } from '../utils/escapeForPrompt.js'

const UNAVAILABLE_MSG = '[Trading context unavailable]'

/** Format a number as USD with 2 decimals and thousand separators. */
function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Format a crypto quantity — up to 8 decimals, trailing zeros stripped. */
function fmtQty(n: number): string {
  if (n === 0) return '0'
  const s = n.toFixed(8)
  return s.replace(/\.?0+$/, '')
}

/** Format P&L with sign and percentage. */
function fmtPnl(pnl: number, pct: number): string {
  const sign = pnl >= 0 ? '+' : ''
  return `${sign}$${fmtUsd(pnl)} (${sign}${pct.toFixed(2)}%)`
}

/** Build the guardian line. Returns empty string if no companion is set. */
function buildGuardianLine(): string {
  const companion = getCompanion()
  if (!companion) return ''
  const name = getMasterName(companion.species)
  const stars = RARITY_STARS[companion.rarity]
  const rarityLabel =
    companion.rarity.charAt(0).toUpperCase() + companion.rarity.slice(1)
  return `**Guardian:** ${name} (${rarityLabel} ${stars})\n`
}

/** Build the balance section from an array of Balance entries. */
function buildBalanceLine(balances: Balance[]): string {
  if (balances.length === 0) return '**Balance:** No balances\n'

  const lines: string[] = []
  for (const b of balances) {
    if (b.total <= 0) continue
    // SECURITY: currency strings come from the exchange API and are
    // attacker-controllable. Sanitize before LLM injection (Sprint 145).
    const currency = sanitizeShortString(b.currency, 16)
    const parts: string[] = [`${fmtUsd(b.free)} ${currency} (free)`]
    if (b.used > 0) {
      parts.push(`${fmtUsd(b.used)} ${currency} (in orders)`)
    }
    lines.push(parts.join(' / '))
  }

  if (lines.length === 0) return '**Balance:** No balances\n'
  return `**Balance:** ${lines.join(', ')}\n`
}

/** Build the positions table. */
function buildPositionsBlock(positions: Position[]): string {
  if (positions.length === 0) return '**Positions:** No open positions\n'

  const header = [
    '**Positions:**',
    '| Symbol | Side | Qty | Entry | Current | P&L |',
    '|--------|------|-----|-------|---------|-----|',
  ]

  const rows = positions.map((p) => {
    // SECURITY: position symbol comes from the exchange API and is
    // attacker-controllable (e.g. a malicious symbol "BTC/USDT\n\nSYSTEM:..."
    // would inject into the LLM prompt). Sanitize before interpolation
    // into the markdown table (Sprint 145). Side is a fixed enum so
    // sanitization is just defense-in-depth.
    const symbol = sanitizeShortString(p.symbol, 32)
    const side = p.side === 'buy' ? 'long' : 'short'
    return `| ${symbol} | ${side} | ${fmtQty(p.quantity)} | ${fmtUsd(p.entryPrice)} | ${fmtUsd(p.currentPrice)} | ${fmtPnl(p.unrealizedPnl, p.unrealizedPnlPercent)} |`
  })

  return [...header, ...rows].join('\n') + '\n'
}

/** Format portfolio heat as a summary line. */
function buildHeatLine(
  positions: Position[],
  balances: Balance[],
  openOrders: import('./exchange/types.js').Order[],
): string {
  const heat = calculatePortfolioHeat(positions, balances, openOrders)
  if (heat.heatPercent <= 0) return '**Portfolio Heat:** 0.0% (no risk)\n'
  const pct = heat.heatPercent.toFixed(1)
  const unhedged = heat.positions.filter((p) => !p.hasStopLoss).length
  const suffix = unhedged > 0 ? ` (${unhedged} without stop-loss)` : ''
  return `**Portfolio Heat:** ${pct}%${suffix}\n`
}

/** Format market regime as a summary line for tracked symbols. */
function buildRegimeLines(symbols: string[]): string {
  const lines: string[] = []
  for (const symbol of symbols) {
    const regime = getLatestRegime(symbol)
    if (!regime) continue
    const label = regime.regime.replace('_', ' ')
    const conf = (regime.confidence * 100).toFixed(0)
    // SECURITY: symbol may originate from a position fetched from the
    // exchange API; sanitize before LLM injection (Sprint 145). Label
    // is a typed enum from the local regime detector so it's safe.
    const safeSymbol = sanitizeShortString(symbol, 32)
    lines.push(`${safeSymbol}: ${label} (${conf}% confidence)`)
  }
  if (lines.length === 0) return ''
  return `**Market Regime:** ${lines.join(', ')}\n`
}

/** Connect, fetch data, and format the trading context block. */
async function fetchAndFormat(exchange: ExchangeInterface): Promise<string> {
  const [balances, positions, openOrders] = await Promise.all([
    exchange.getBalance(),
    exchange.getPositions(),
    exchange.getOpenOrders(),
  ])

  const parts: string[] = ['## Trading Context']
  parts.push(buildGuardianLine())
  parts.push(buildBalanceLine(balances))
  parts.push(buildPositionsBlock(positions))
  parts.push(`**Open Orders:** ${openOrders.length} active`)
  parts.push(buildHeatLine(positions, balances, openOrders))

  // Include regime data for common symbols
  const regimeSymbols = positions.map((p) => p.symbol)
  if (!regimeSymbols.includes('BTC/USDT')) regimeSymbols.push('BTC/USDT')
  if (!regimeSymbols.includes('ETH/USDT')) regimeSymbols.push('ETH/USDT')
  parts.push(buildRegimeLines(regimeSymbols))

  return parts.filter(Boolean).join('\n').trim()
}

/**
 * Build a concise markdown summary of the current trading state.
 *
 * - Fetches balances, positions, and open orders from the exchange.
 * - Includes the guardian master name and rarity when available.
 * - Returns `[Trading context unavailable]` when the exchange is down.
 * - Output is kept under ~2000 characters to stay within the 500-token budget.
 */
export async function buildTradingContext(): Promise<string> {
  try {
    const exchange = await getConnectedExchange()
    return await fetchAndFormat(exchange)
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'unknown exchange error'
    return `${UNAVAILABLE_MSG}\nReason: ${message}`
  }
}
