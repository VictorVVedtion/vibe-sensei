/**
 * Market Hours check for stock trading.
 * Evaluates whether the US stock market is currently open.
 *
 * Thresholds:
 *   pass:  market open (regular session 9:30 AM - 4:00 PM ET)
 *   warn:  pre-market (4:00 AM - 9:30 AM ET) or after-hours (4:00 PM - 8:00 PM ET)
 *   fail:  market closed (weekend, holiday, or outside extended hours)
 */

import type { VerticalContext } from '../../verticals.js'
import type { CheckResult } from '../../../tools/PreTradeGateTool/types.js'

export function checkMarketHours(ctx: VerticalContext): CheckResult {
  const isOpen = ctx.isMarketHours

  // When isMarketHours is explicitly provided (e.g. from Alpaca clock API)
  if (isOpen === true) {
    return {
      name: 'Stocks: Market Hours',
      status: 'pass',
      message: 'US stock market is open — regular trading session',
    }
  }

  if (isOpen === false) {
    // Determine if it's extended hours or fully closed
    const period = getMarketPeriod()

    if (period === 'extended') {
      return {
        name: 'Stocks: Market Hours',
        status: 'warn',
        message: 'Market in extended hours — lower liquidity and wider spreads',
        recommendation: 'Use limit orders during pre-market/after-hours. Expect higher slippage on market orders.',
      }
    }

    return {
      name: 'Stocks: Market Hours',
      status: 'fail',
      message: 'US stock market is closed — orders will be queued',
      recommendation: 'Wait for market open (9:30 AM ET) or use limit orders that persist to next session.',
    }
  }

  // When isMarketHours is undefined, use heuristic based on current time
  const period = getMarketPeriod()

  if (period === 'open') {
    return {
      name: 'Stocks: Market Hours',
      status: 'pass',
      message: 'US stock market appears open (based on current ET time)',
    }
  }

  if (period === 'extended') {
    return {
      name: 'Stocks: Market Hours',
      status: 'warn',
      message: 'Extended hours trading — lower liquidity expected',
      recommendation: 'Use limit orders during pre-market/after-hours to avoid poor fills.',
    }
  }

  return {
    name: 'Stocks: Market Hours',
    status: 'fail',
    message: 'US stock market appears closed (weekend or outside trading hours)',
    recommendation: 'Wait for market open or place limit orders for next session.',
  }
}

type MarketPeriod = 'open' | 'extended' | 'closed'

/**
 * Heuristic market period based on current time converted to ET.
 * Does not account for holidays — use Alpaca /v2/clock for accuracy.
 */
function getMarketPeriod(): MarketPeriod {
  const now = new Date()
  const day = now.getUTCDay()

  // Weekend check (Saturday = 6, Sunday = 0)
  if (day === 0 || day === 6) return 'closed'

  // Convert to Eastern Time (approximate: UTC-5 standard, UTC-4 daylight)
  // Use a rough heuristic — DST runs March second Sunday to November first Sunday
  const month = now.getUTCMonth() // 0-indexed
  const isDST = month >= 2 && month <= 10 // March through October (approximate)
  const etOffset = isDST ? 4 : 5
  const etHour = (now.getUTCHours() - etOffset + 24) % 24
  const etMinute = now.getUTCMinutes()
  const etTime = etHour * 60 + etMinute

  // Regular session: 9:30 AM - 4:00 PM ET (570 - 960 minutes)
  if (etTime >= 570 && etTime < 960) return 'open'

  // Pre-market: 4:00 AM - 9:30 AM ET (240 - 570 minutes)
  // After-hours: 4:00 PM - 8:00 PM ET (960 - 1200 minutes)
  if ((etTime >= 240 && etTime < 570) || (etTime >= 960 && etTime < 1200)) {
    return 'extended'
  }

  return 'closed'
}
