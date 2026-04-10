import { useState, useEffect } from 'react'
import type { TiltState } from '../../shared/ipc-channels'

const EMPTY_TILT: TiltState = {
  level: 'none',
  score: 0,
  triggers: [],
  recommendation: '',
  timestamp: 0,
}

export function useTiltState(): TiltState {
  const [tilt, setTilt] = useState<TiltState>(EMPTY_TILT)

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api || typeof api.onTiltState !== 'function') return

    const cleanup = api.onTiltState((data: TiltState) => {
      setTilt(data)
    })

    return () => {
      if (typeof cleanup === 'function') cleanup()
    }
  }, [])

  return tilt
}
