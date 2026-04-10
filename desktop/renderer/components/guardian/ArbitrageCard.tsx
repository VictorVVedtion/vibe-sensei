import { useState, useCallback } from 'react'

interface ArbitrageOpportunity {
  pair: string
  type: string
  spread: string
  status: 'live' | 'expired'
}

const PLACEHOLDER: ArbitrageOpportunity = {
  pair: 'BTC SPOT VS PERP',
  type: 'basis',
  spread: '0.03%',
  status: 'live',
}

export function ArbitrageCard() {
  const [executing, setExecuting] = useState(false)
  const opportunity = PLACEHOLDER

  const handleExecute = useCallback(() => {
    setExecuting(true)
    const timer = setTimeout(() => setExecuting(false), 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.icon}>{'\u26A0'}</span>
        <span style={styles.title}>ARBITRAGE DETECTED</span>
      </div>

      {/* Body */}
      <div style={styles.body}>
        <span style={styles.pairLabel}>{opportunity.pair}</span>
        <span style={styles.spread}>{opportunity.spread}</span>
      </div>

      {/* Execute button */}
      <button
        style={{
          ...styles.button,
          opacity: executing ? 0.6 : 1,
          cursor: executing ? 'wait' : 'pointer',
        }}
        onClick={handleExecute}
        disabled={executing}
        type="button"
      >
        {executing ? 'EXECUTING...' : 'EXECUTE_LOOP'}
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'rgba(242, 54, 69, 0.05)',
    border: '1px solid rgba(242, 54, 69, 0.5)',
    borderRadius: 0,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 10px',
  },
  icon: {
    fontSize: 12,
    color: 'var(--error)',
  },
  title: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--error)',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  body: {
    padding: '0 10px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  pairLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    color: 'var(--error-dim)',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  spread: {
    fontFamily: 'var(--font-mono)',
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--error)',
    fontVariantNumeric: 'tabular-nums' as const,
  },
  button: {
    width: '100%',
    padding: '8px 0',
    border: 'none',
    borderTop: '1px solid rgba(242, 54, 69, 0.3)',
    background: 'var(--error)',
    color: 'var(--on-error)',
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    transition: 'opacity 200ms ease, background 200ms steps(3)',
  },
}
