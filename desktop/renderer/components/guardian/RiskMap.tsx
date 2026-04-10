import type { TradingPosition } from '../../../shared/ipc-channels'

interface RiskMapProps {
  positions: TradingPosition[]
  totalValue: number
}

interface VenueData {
  name: string
  symbols: string[]
  exposure: number
  maxExposure: number
}

function groupByVenue(positions: TradingPosition[]): VenueData[] {
  const venueMap = new Map<string, { symbols: Set<string>; exposure: number }>()

  for (const pos of positions) {
    const venue = inferVenue(pos.symbol)
    const entry = venueMap.get(venue) ?? { symbols: new Set<string>(), exposure: 0 }
    const base = pos.symbol.split('/')[0] ?? pos.symbol
    entry.symbols.add(base)
    entry.exposure += Math.abs(pos.quantity * pos.currentPrice)
    venueMap.set(venue, entry)
  }

  return Array.from(venueMap.entries()).map(([name, data]) => ({
    name,
    symbols: Array.from(data.symbols),
    exposure: data.exposure,
    maxExposure: data.exposure * 1.5,
  }))
}

function inferVenue(symbol: string): string {
  if (symbol.includes('PERP') || symbol.includes(':')) return 'PERP'
  if (symbol.includes('-C') || symbol.includes('-P')) return 'OPTIONS'
  return 'SPOT'
}

function formatUsd(n: number): string {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}

export function RiskMap({ positions, totalValue }: RiskMapProps) {
  const venues = groupByVenue(positions)
  const venueCount = venues.length || 1
  const totalExposure = venues.reduce((sum, v) => sum + v.exposure, 0)

  return (
    <div style={styles.card}>
      {/* Header bar */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>[CROSS-VENUE RISK MAP]</span>
        <span style={styles.headerControls}>[&#9633; x]</span>
      </div>

      {/* Venue rows */}
      <div style={styles.body}>
        {venues.length === 0 ? (
          <div style={styles.emptyRow}>
            <span style={styles.emptyText}>NO ACTIVE VENUES</span>
          </div>
        ) : (
          venues.map((venue) => {
            const pct = venue.maxExposure > 0
              ? Math.min((venue.exposure / venue.maxExposure) * 100, 100)
              : 0
            return (
              <div key={venue.name} style={styles.venueRow}>
                <span style={styles.venueLabel}>
                  {venue.name} [{venue.symbols.join('/')}]
                </span>
                <div style={styles.barTrack}>
                  <div style={{ ...styles.barFill, width: `${pct}%` }} />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <span style={styles.footerText}>
          {formatUsd(totalExposure || totalValue)} ACROSS {venueCount} VENUE{venueCount !== 1 ? 'S' : ''}
        </span>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#000000',
    border: '1px solid rgba(156, 255, 147, 0.3)',
    borderRadius: 0,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 10px',
    background: 'rgba(156, 255, 147, 0.1)',
    borderBottom: '1px solid rgba(156, 255, 147, 0.3)',
  },
  headerTitle: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--primary)',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  headerControls: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: 'var(--text-tertiary)',
    cursor: 'default',
  },
  body: {
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  venueRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  venueLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  barTrack: {
    height: 4,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 0,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: 'var(--primary)',
    transition: 'width 400ms ease',
  },
  emptyRow: {
    padding: '8px 0',
    textAlign: 'center' as const,
  },
  emptyText: {
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    color: 'var(--text-tertiary)',
    letterSpacing: 1,
  },
  footer: {
    padding: '6px 10px',
    textAlign: 'center' as const,
    borderTop: '1px solid rgba(156, 255, 147, 0.1)',
  },
  footerText: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--primary)',
    letterSpacing: 0.5,
  },
}
