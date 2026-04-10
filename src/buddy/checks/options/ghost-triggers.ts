/**
 * Options-specific ghost trigger detection.
 *
 * Nick Leeson / Barings Bank: selling options without defined max loss (naked/uncovered).
 * OptionSellers.com: portfolio has net negative gamma (short volatility).
 */

import type { GhostWarning } from '../../ghost-warnings.js'
import { OPTIONS_GHOST_WARNINGS } from './ghost-registry.js'

const NICK_LEESON = OPTIONS_GHOST_WARNINGS[0]!
const OPTION_SELLERS = OPTIONS_GHOST_WARNINGS[1]!

/**
 * Nick Leeson trigger: selling options without defined max loss.
 * Pattern: Barings Bank collapsed because Leeson sold naked straddles
 * on the Nikkei 225, exposing the bank to unlimited downside.
 *
 * @param hasNakedShort - true if portfolio contains a naked/uncovered short option
 */
export function checkNickLeesonTrigger(
  hasNakedShort: boolean,
): GhostWarning | null {
  if (!hasNakedShort) return null

  return {
    ghostId: NICK_LEESON.id,
    ghostName: NICK_LEESON.name,
    quote: NICK_LEESON.quote,
    triggerReason: 'Selling naked options — unlimited loss exposure, the Barings pattern',
    timestamp: new Date(),
  }
}

/**
 * OptionSellers.com trigger: portfolio has net negative gamma (short volatility).
 * Pattern: James Cordier's fund blew up when natural gas volatility spiked
 * and his net short gamma portfolio imploded.
 *
 * @param netGamma - portfolio aggregate gamma
 */
export function checkOptionSellersTrigger(
  netGamma: number,
): GhostWarning | null {
  if (netGamma >= 0) return null

  return {
    ghostId: OPTION_SELLERS.id,
    ghostName: OPTION_SELLERS.name,
    quote: OPTION_SELLERS.quote,
    triggerReason: `Net gamma ${netGamma.toFixed(6)} — short volatility portfolio, one spike away from wipeout`,
    timestamp: new Date(),
  }
}
