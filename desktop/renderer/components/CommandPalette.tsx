/**
 * CommandPalette — Cmd+K overlay for quick navigation and actions.
 * Fuzzy-searches available commands, symbols, and guardian features.
 */

import { useState, useEffect, useRef, useCallback } from 'react'

interface PaletteItem {
  id: string
  label: string
  category: string
  shortcut?: string
  action: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onSendChat: (message: string) => void
}

const BUILT_IN_COMMANDS: Omit<PaletteItem, 'action'>[] = [
  { id: 'buy', label: 'Buy / Long', category: 'Trade', shortcut: 'Cmd+B' },
  { id: 'sell', label: 'Sell / Short', category: 'Trade', shortcut: 'Cmd+S' },
  { id: 'positions', label: 'View Positions', category: 'Portfolio' },
  { id: 'balance', label: 'Check Balance', category: 'Portfolio' },
  { id: 'analyze-btc', label: 'Analyze BTC', category: 'Analysis' },
  { id: 'analyze-eth', label: 'Analyze ETH', category: 'Analysis' },
  { id: 'risk-check', label: 'Run Risk Check', category: 'Guardian' },
  { id: 'consult', label: 'Consult Guardian', category: 'Guardian' },
  { id: 'debate', label: 'Start Debate', category: 'Guardian' },
  { id: 'watchlist', label: 'View Watchlist', category: 'Market' },
  { id: 'funding', label: 'Funding Rates', category: 'Market' },
  { id: 'options-chain', label: 'Options Chain', category: 'Derivatives' },
  { id: 'greeks', label: 'Options Greeks', category: 'Derivatives' },
]

const COMMAND_TO_MESSAGE: Record<string, string> = {
  'buy': '/buy ',
  'sell': '/sell ',
  'positions': 'Show my open positions',
  'balance': 'Show my portfolio balance',
  'analyze-btc': 'Analyze BTC/USDT - trend, support, resistance',
  'analyze-eth': 'Analyze ETH/USDT - trend, support, resistance',
  'risk-check': 'Run a pre-trade risk gate check on my portfolio',
  'consult': 'I want a second opinion from another guardian',
  'debate': 'Start a debate about my current positions',
  'watchlist': 'Show top crypto prices',
  'funding': 'Show perpetual futures funding rates',
  'options-chain': 'Show BTC options chain',
  'greeks': 'Calculate options greeks for BTC call',
}

export function CommandPalette({ isOpen, onClose, onSendChat }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = BUILT_IN_COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  )

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isOpen])

  const executeItem = useCallback((item: typeof BUILT_IN_COMMANDS[0]) => {
    const message = COMMAND_TO_MESSAGE[item.id]
    if (message) {
      onSendChat(message)
    }
    onClose()
  }, [onSendChat, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = filtered[selectedIndex]
      if (item) executeItem(item)
    }
  }, [filtered, selectedIndex, executeItem, onClose])

  if (!isOpen) return null

  return (
    <div className="palette-backdrop" onClick={onClose} role="dialog" aria-label="Command palette" aria-modal="true">
      <div className="palette-container" onClick={e => e.stopPropagation()}>
        <div className="palette-input-row">
          <span className="palette-prompt">{'>'}</span>
          <input
            ref={inputRef}
            className="palette-input"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands..."
            aria-label="Search commands"
            role="combobox"
            aria-expanded={filtered.length > 0}
            aria-autocomplete="list"
          />
        </div>

        <div className="palette-results">
          {filtered.length === 0 ? (
            <div className="palette-empty">No matching commands</div>
          ) : (
            filtered.map((item, i) => (
              <div
                key={item.id}
                className={`palette-item${i === selectedIndex ? ' palette-item--selected' : ''}`}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => executeItem(item)}
              >
                <span className="palette-item-category">{item.category}</span>
                <span className="palette-item-label">{item.label}</span>
                {item.shortcut && (
                  <span className="palette-item-shortcut">{item.shortcut}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
