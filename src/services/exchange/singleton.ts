/**
 * Global exchange instance singleton.
 * All trading tools and services share this instance.
 * Default: paper trading with 100k USDT.
 */

import { createExchange, type ExchangeInterface } from './index.js'
import type { ExchangeConfig } from './types.js'

let instance: ExchangeInterface | null = null
let connected = false
let connectionPromise: Promise<ExchangeInterface> | null = null

export function getExchange(): ExchangeInterface {
  if (!instance) {
    instance = createExchange({ mode: 'paper' })
  }
  return instance
}

export async function getConnectedExchange(): Promise<ExchangeInterface> {
  const exchange = getExchange()
  if (connected) return exchange
  if (!connectionPromise) {
    connectionPromise = exchange.connect().then(() => {
      connected = true
      return exchange
    }).catch((err) => {
      connectionPromise = null
      connected = false
      throw err
    })
  }
  return connectionPromise
}

export function resetExchange(config?: ExchangeConfig): void {
  instance = createExchange(config ?? { mode: 'paper' })
  connected = false
  connectionPromise = null
}
