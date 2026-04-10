/**
 * Arbitrage module — cross-venue arbitrage scanning.
 */

export {
  CrossVenueScanner,
  getArbitrageScanner,
  resetArbitrageScanner,
  scanForArbitrage,
} from './cross-venue-scanner.js'

export type {
  ArbitrageOpportunity,
  ArbitrageType,
} from './cross-venue-scanner.js'
