export interface OhlcData {
  open: number
  high: number
  low: number
  close: number
}

interface OhlcBarProps {
  symbol: string
  lastPrice: number | null
  prevClose: number | null
  crosshairData: OhlcData | null
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toFixed(2)
  if (price >= 1) return price.toFixed(4)
  return price.toFixed(6)
}

export function OhlcBar({
  symbol,
  lastPrice,
  prevClose,
  crosshairData,
}: OhlcBarProps) {
  const displayData = crosshairData
  const isUp =
    lastPrice !== null && prevClose !== null ? lastPrice >= prevClose : true
  const priceColor = isUp ? '#00E5A0' : '#FF4D6A'

  const ohlcColor = displayData
    ? displayData.close >= displayData.open
      ? '#00E5A0'
      : '#FF4D6A'
    : '#7B8AA0'

  return (
    <div className="ohlc-bar-panel">
      <div className="price-info">
        <span className="symbol-label">{symbol}</span>
        {lastPrice !== null && (
          <span className="last-price" style={{ color: priceColor }}>
            {formatPrice(lastPrice)}
          </span>
        )}
      </div>
      <div className="ohlc-values">
        {displayData ? (
          <>
            <span>
              <span className="label">O</span>{' '}
              <span style={{ color: ohlcColor }}>
                {formatPrice(displayData.open)}
              </span>
            </span>
            <span>
              <span className="label">H</span>{' '}
              <span style={{ color: ohlcColor }}>
                {formatPrice(displayData.high)}
              </span>
            </span>
            <span>
              <span className="label">L</span>{' '}
              <span style={{ color: ohlcColor }}>
                {formatPrice(displayData.low)}
              </span>
            </span>
            <span>
              <span className="label">C</span>{' '}
              <span style={{ color: ohlcColor }}>
                {formatPrice(displayData.close)}
              </span>
            </span>
          </>
        ) : null}
      </div>
    </div>
  )
}
