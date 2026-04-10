/**
 * Bridge service — barrel exports for the deBridge client.
 *
 * NOT a trading venue — does not register in VenueRegistry.
 * Advisory-only: fetches cross-chain transfer quotes via deBridge REST API.
 */

export {
  getBridgeQuote,
  resolveChain,
  listSupportedChains,
  type BridgeQuote,
  type BridgeQuoteParams,
} from './bridge-client.js'
