import { useState, useEffect } from 'react'

/**
 * Hook to get the UDF chart server port from the Electron main process via IPC.
 * Polls the main process until the UDF server is confirmed ready, then returns port 3456.
 */
export function useUdfPort(): number | null {
  const [port, setPort] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function check(): Promise<boolean> {
      try {
        // Browser fallback: electronAPI not available, try direct HTTP
        if (!window.electronAPI?.isUdfReady) {
          const res = await fetch('http://localhost:3456/time').catch(() => null)
          if (res?.ok && !cancelled) {
            setPort(3456)
            return true
          }
          return false
        }
        const ready = await window.electronAPI.isUdfReady()
        if (ready && !cancelled) {
          const udfPort: number = await window.electronAPI.getUdfPort()
          setPort(udfPort)
          return true
        }
      } catch (err) {
        console.error('[useUdfPort] UDF ready check failed:', err)
      }
      return false
    }

    async function resolve(): Promise<void> {
      // First immediate check
      if (await check()) return

      // Browser fallback: poll HTTP directly
      if (!window.electronAPI?.onUdfReady) {
        const pollId = setInterval(async () => {
          if (cancelled) { clearInterval(pollId); return }
          if (await check()) clearInterval(pollId)
        }, 500)
        cleanupRef = () => clearInterval(pollId)
        return
      }

      // Listen for the udf:ready event from main process
      const cleanup = window.electronAPI.onUdfReady(() => {
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
