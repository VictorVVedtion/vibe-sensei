/**
 * WatchlistPanel — narrow far-left price column (60px).
 * Shows real-time prices for tracked symbols across all verticals.
 * Click a symbol to switch the chart.
 */

import { useState, useEffect, useRef } from 'react'

interface WatchItem {
  symbol: string
  label: string
  price: string
  change: number // percentage
}

const DEFAULT_WATCHLIST: WatchItem[] = [
  { symbol: 'BTCUSDT', label: 'BTC', price: '67.4K', change: 2.1 },
  { symbol: 'ETHUSDT', label: 'ETH', price: '3.2K', change: -0.8 },
  { symbol: 'SOLUSDT', label: 'SOL', price: '148', change: 4.3 },
  { symbol: 'BNBUSDT', label: 'BNB', price: '612', change: 1.1 },
  { symbol: 'XRPUSDT', label: 'XRP', price: '0.52', change: -1.4 },
  { symbol: 'ADAUSDT', label: 'ADA', price: '0.44', change: 0.3 },
  { symbol: 'DOGEUSDT', label: 'DOGE', price: '0.16', change: 5.7 },
  { symbol: 'AVAXUSDT', label: 'AVAX', price: '36.2', change: -2.1 },
]

interface WatchlistPanelProps {
  activeSymbol?: string
  onSymbolClick?: (symbol: string) => void
  port: number | null
}

export function WatchlistPanel({ activeSymbol = 'BTCUSDT', onSymbolClick, port }: WatchlistPanelProps) {
  const [items, setItems] = useState<WatchItem[]>(DEFAULT_WATCHLIST)
  const wsRef = useRef<WebSocket | null>(null)

  // Connect to market WebSocket for live price updates
  useEffect(() => {
    if (!port) return
    const ws = new WebSocket(`ws://localhost:${port}/ws/market`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'ticker' && msg.data) {
          const { symbol, last, changePercent } = msg.data
          setItems(prev => prev.map(item => {
            const wsSymbol = item.label + '/USDT'
            if (wsSymbol === symbol || item.symbol === symbol) {
              return {
                ...item,
                price: formatCompactPrice(last),
                change: changePercent ?? item.change,
              }
            }
            return item
          }))
        }
      } catch { /* ignore */ }
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [port])

  return (
    <div className="watchlist-panel">
      <div className="watchlist-header">WATCH</div>
      {items.map(item => (
        <div
          key={item.symbol}
          className={`watchlist-item${item.symbol === activeSymbol ? ' watchlist-item--active' : ''}`}
          onClick={() => onSymbolClick?.(item.symbol)}
          role="button"
          tabIndex={0}
          aria-label={`${item.label} ${item.price}${item.symbol === activeSymbol ? ' (selected)' : ''}`}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSymbolClick?.(item.symbol) } }}
        >
          <div className="watchlist-item-symbol">{item.label}</div>
          <div className={`watchlist-item-price${item.change >= 0 ? ' price-up' : ' price-down'}`}>
            {item.price}
          </div>
        </div>
      ))}
    </div>
  )
}

function formatCompactPrice(price: number): string {
  if (price >= 10000) return (price / 1000).toFixed(1) + 'K'
  if (price >= 1000) return (price / 1000).toFixed(1) + 'K'
  if (price >= 1) return price.toFixed(0)
  return price.toFixed(2)
}
