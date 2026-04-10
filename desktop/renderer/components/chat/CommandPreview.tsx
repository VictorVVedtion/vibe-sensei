/**
 * CommandPreview — renders an order preview card when the user types
 * a trading command (/buy, /sell, /swap). Shows parsed params, estimated
 * cost, and guardian opinion before execution.
 */

import { useState, useEffect } from 'react'

interface CommandPreviewProps {
  command: string
  onConfirm: () => void
  onCancel: () => void
}

interface ParsedCommand {
  action: string
  amount?: string
  symbol?: string
  price?: string
  raw: string
}

const COMMAND_PATTERNS: Record<string, RegExp> = {
  buy: /^\/(buy|long)\s+(\S+)\s+(\S+)(?:\s+@\s*(\S+))?/i,
  sell: /^\/(sell|short)\s+(\S+)\s+(\S+)(?:\s+@\s*(\S+))?/i,
  swap: /^\/swap\s+(\S+)\s+(\S+)\s+(?:to|for)\s+(\S+)/i,
}

function parseCommand(input: string): ParsedCommand | null {
  for (const [action, pattern] of Object.entries(COMMAND_PATTERNS)) {
    const match = input.match(pattern)
    if (match) {
      if (action === 'swap') {
        return { action: 'swap', amount: match[1], symbol: `${match[2]} → ${match[3]}`, raw: input }
      }
      return { action, amount: match[2], symbol: match[3], price: match[4], raw: input }
    }
  }
  return null
}

export function CommandPreview({ command, onConfirm, onCancel }: CommandPreviewProps) {
  const parsed = parseCommand(command)
  if (!parsed) return null

  const actionColor = parsed.action === 'sell' || parsed.action === 'short'
    ? 'var(--error)'
    : 'var(--primary)'

  return (
    <div className="command-preview">
      <div className="command-preview-header">
        <span style={{ color: actionColor, fontWeight: 700 }}>
          {parsed.action.toUpperCase()}
        </span>
        <span className="command-preview-symbol">{parsed.symbol}</span>
      </div>

      <div className="command-preview-details">
        {parsed.amount && (
          <div className="command-preview-row">
            <span className="command-preview-label">Amount</span>
            <span className="command-preview-value">{parsed.amount}</span>
          </div>
        )}
        {parsed.price && (
          <div className="command-preview-row">
            <span className="command-preview-label">Price</span>
            <span className="command-preview-value">@ {parsed.price}</span>
          </div>
        )}
      </div>

      <div className="command-preview-actions">
        <button className="command-preview-btn command-preview-btn--confirm" onClick={onConfirm} aria-label="Confirm trade order">
          CONFIRM
        </button>
        <button className="command-preview-btn command-preview-btn--cancel" onClick={onCancel} aria-label="Cancel trade order">
          CANCEL
        </button>
      </div>
    </div>
  )
}

/** Detect if user input looks like a trade command */
export function isTradeCommand(input: string): boolean {
  return /^\/(buy|sell|long|short|swap)\s/i.test(input)
}
