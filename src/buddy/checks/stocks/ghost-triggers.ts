/**
 * Stock-specific ghost trigger detection.
 *
 * WorldCom: earnings proximity + high concentration in a single stock.
 * Bear Stearns: high portfolio concentration in financial sector stocks.
 */

import type { Position, Balance } from '../../../services/exchange/types.js'
import type { GhostWarning } from '../../ghost-warnings.js'
import { STOCK_GHOST_WARNINGS } from './ghost-registry.js'

const WORLDCOM = STOCK_GHOST_WARNINGS[0]!
const BEAR_STEARNS = STOCK_GHOST_WARNINGS[1]!

/** Financial sector tickers — common large-cap bank and financial stocks. */
const FINANCIAL_TICKERS = new Set([
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'BK', 'USB',
  'PNC', 'TFC', 'SCHW', 'COF', 'AXP', 'BLK', 'SPGI',
  'ICE', 'CME', 'MCO', 'MMC', 'AIG', 'MET', 'PRU',
  'ALL', 'TRV', 'CB', 'AFL', 'FITB', 'RF', 'KEY',
  'CFG', 'HBAN', 'MTB', 'ZION', 'FRC', 'SIVB', 'WAL',
  'XLF', 'KRE', 'KBE', 'VFH', // Financial ETFs count too
])

/**
 * WorldCom trigger: earnings proximity + high concentration in a single stock.
 * Pattern: WorldCom fraudulently inflated earnings, and investors who were
 * concentrated in the stock lost everything when the fraud was revealed.
 *
 * Triggers when: any single stock is >50% of portfolio AND earnings < 7 days.
 *
 * @param positions - current stock positions
 * @param balances - account balances
 * @param daysToEarnings - days to earnings for the concentrated stock (undefined = no data)
 */
export function checkWorldComTrigger(
  positions: Position[],
  balances: Balance[],
  daysToEarnings?: number,
): GhostWarning | null {
  if (positions.length === 0) return null
  if (daysToEarnings == null || daysToEarnings > 7) return null

  const totalBalance = balances.reduce((sum, b) => sum + b.total, 0)
  if (totalBalance <= 0) return null

  for (const pos of positions) {
    const posValue = Math.abs(pos.quantity) * pos.currentPrice
    const concentration = posValue / totalBalance

    if (concentration > 0.5) {
      return {
        ghostId: WORLDCOM.id,
        ghostName: WORLDCOM.name,
        quote: WORLDCOM.quote,
        triggerReason: `${pos.symbol} is ${(concentration * 100).toFixed(0)}% of portfolio with earnings in ${daysToEarnings} days — concentrated earnings bet`,
        timestamp: new Date(),
      }
    }
  }

  return null
}

/**
 * Bear Stearns trigger: high portfolio concentration in financial sector.
 * Pattern: Bear Stearns collapsed from a liquidity crisis — all financial
 * stocks cratered together. Concentration in financials = correlated crash risk.
 *
 * Triggers when: financial sector stocks represent >60% of total portfolio.
 *
 * @param positions - current stock positions
 * @param balances - account balances
 */
export function checkBearStearnsTrigger(
  positions: Position[],
  balances: Balance[],
): GhostWarning | null {
  if (positions.length === 0) return null

  const totalBalance = balances.reduce((sum, b) => sum + b.total, 0)
  if (totalBalance <= 0) return null

  let financialNotional = 0
  const financialSymbols: string[] = []

  for (const pos of positions) {
    const ticker = pos.symbol.toUpperCase()
    if (FINANCIAL_TICKERS.has(ticker)) {
      financialNotional += Math.abs(pos.quantity) * pos.currentPrice
      financialSymbols.push(ticker)
    }
  }

  const financialConcentration = financialNotional / totalBalance
  if (financialConcentration <= 0.6) return null

  return {
    ghostId: BEAR_STEARNS.id,
    ghostName: BEAR_STEARNS.name,
    quote: BEAR_STEARNS.quote,
    triggerReason: `${(financialConcentration * 100).toFixed(0)}% portfolio in financials (${financialSymbols.join(', ')}) — sector liquidity crisis risk`,
    timestamp: new Date(),
  }
}
