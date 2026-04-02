interface StatusBarProps {
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected'
  symbol: string
  lastPrice: number | null
  prevClose: number | null
}

const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Macintosh')
const modKey = isMac ? 'Cmd' : 'Ctrl'

function formatPrice(price: number): string {
  if (price >= 1000) return price.toFixed(2)
  if (price >= 1) return price.toFixed(4)
  return price.toFixed(6)
}

function connectionLabel(status: StatusBarProps['connectionStatus']): string {
  switch (status) {
    case 'connected':
      return 'Connected'
    case 'reconnecting':
      return 'Reconnecting...'
    case 'disconnected':
      return 'Disconnected'
  }
}

export function StatusBar({
  connectionStatus,
  symbol,
  lastPrice,
  prevClose,
}: StatusBarProps) {
  const isUp =
    lastPrice !== null && prevClose !== null ? lastPrice >= prevClose : true
  const priceClass = isUp ? 'up' : 'down'

  return (
    <div className="status-bar">
      <div className="status-section">
        <span className={`connection-dot ${connectionStatus}`} />
        <span>{connectionLabel(connectionStatus)}</span>
      </div>

      <div className="status-section pair-info">
        <span>{symbol.replace('USDT', '/USDT')}</span>
        {lastPrice !== null && (
          <span className={`last-price-val ${priceClass}`}>
            {formatPrice(lastPrice)}
          </span>
        )}
      </div>

      <div className="status-section">
        <span className="mode-badge">Paper Trading</span>
      </div>

      <div className="shortcuts">
        <span className="shortcut-key">{modKey}+1</span> Terminal{' '}
        <span className="shortcut-key">{modKey}+2</span> Chart{' '}
        <span className="shortcut-key">{modKey}+3</span> Sidebar
      </div>
    </div>
  )
}
