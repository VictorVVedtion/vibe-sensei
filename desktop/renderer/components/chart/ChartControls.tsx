interface ChartControlsProps {
  symbol: string
  resolution: string
  onSymbolChange: (symbol: string) => void
  onResolutionChange: (resolution: string) => void
}

const SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'DOTUSDT',
  'LINKUSDT',
]

const TIMEFRAMES: Array<{ label: string; resolution: string }> = [
  { label: '1m', resolution: '1' },
  { label: '5m', resolution: '5' },
  { label: '15m', resolution: '15' },
  { label: '1H', resolution: '60' },
  { label: '4H', resolution: '240' },
  { label: '1D', resolution: 'D' },
]

export function ChartControls({
  symbol,
  resolution,
  onSymbolChange,
  onResolutionChange,
}: ChartControlsProps) {
  return (
    <div className="chart-controls">
      <span className="logo">VIBE SENSEI</span>
      <div className="separator" />
      <select
        className="symbol-select"
        value={symbol}
        onChange={(e) => onSymbolChange(e.target.value)}
      >
        {SYMBOLS.map((s) => (
          <option key={s} value={s}>
            {s.replace('USDT', '/USDT')}
          </option>
        ))}
      </select>
      <div className="separator" />
      <div className="tf-group">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.resolution}
            className={`tf-btn${resolution === tf.resolution ? ' active' : ''}`}
            onClick={() => onResolutionChange(tf.resolution)}
          >
            {tf.label}
          </button>
        ))}
      </div>
    </div>
  )
}
