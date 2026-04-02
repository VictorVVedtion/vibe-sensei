/**
 * Global exchange instance singleton.
 * All trading tools and services share this instance.
 * Default: paper trading with 100k USDT.
 */

import { createExchange, type ExchangeInterface } from './index.js'
import type { ExchangeConfig } from './types.js'

let instance: ExchangeInterface | null = null
let connected = false

export function getExchange(): ExchangeInterface {
  if (!instance) {
    instance = createExchange({ mode: 'paper' })
  }
  return instance
}

export async function getConnectedExchange(): Promise<ExchangeInterface> {
  const exchange = getExchange()
  if (!connected) {
    await exchange.connect()
    connected = true
  }
  return exchange
}

export function resetExchange(config?: ExchangeConfig): void {
  instance = createExchange(config ?? { mode: 'paper' })
  connected = false
}
