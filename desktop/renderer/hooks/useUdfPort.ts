import { useState, useEffect } from 'react'

/**
 * Hook to get the UDF chart server port from the Electron main process via IPC.
 * Returns null until the PTY is ready and the UDF server is confirmed responding.
 */
export function useUdfPort(): number | null {
  const [port, setPort] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function resolve(): Promise<void> {
      try {
        const ready = await window.electronAPI.isPtyReady()
        if (ready) {
          const udfPort: number = await window.electronAPI.getUdfPort()
          if (!cancelled) {
            setPort(udfPort)
          }
          return
        }
      } catch (err) {
        console.error('[useUdfPort] PTY ready check failed:', err)
      }

      // Not ready yet — listen for the pty:ready event from main process
      if (cancelled) return
      const cleanup = window.electronAPI.onPtyReady(() => {
        if (cancelled) return
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
        cleanup()
      })

      // Store cleanup for teardown
      cleanupRef = cleanup
    }

    let cleanupRef: (() => void) | null = null
    resolve()

    return () => {
      cancelled = true
      cleanupRef?.()
    }
  }, [])

  return port
}
