import { useState, useEffect } from 'react'

/**
 * Hook to get the UDF chart server port from the Electron main process via IPC.
 * Returns null until the port is available.
 */
export function useUdfPort(): number | null {
  const [port, setPort] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    window.electronAPI
      .getUdfPort()
      .then((udfPort: number) => {
        if (!cancelled) {
          setPort(udfPort)
        }
      })
      .catch((err: Error) => {
        console.error('[useUdfPort] Failed to get UDF port:', err.message)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return port
}
