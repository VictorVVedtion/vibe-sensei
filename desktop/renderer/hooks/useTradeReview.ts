import { useState, useEffect, useCallback } from 'react'
import type { TradeReview } from '../../shared/ipc-channels'

interface UseTradeReviewResult {
  review: TradeReview | null
  dismiss: () => void
}

export function useTradeReview(): UseTradeReviewResult {
  const [review, setReview] = useState<TradeReview | null>(null)

  const dismiss = useCallback(() => {
    setReview(null)
  }, [])

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api) return

    let cleanupReview: (() => void) | undefined
    if (typeof api.onTradeReview === 'function') {
      cleanupReview = api.onTradeReview((data: TradeReview) => {
        setReview(data)
      })
    }

    return () => {
      if (typeof cleanupReview === 'function') cleanupReview()
    }
  }, [])

  // Auto-dismiss after 60 seconds
  useEffect(() => {
    if (!review) return

    const timer = setTimeout(() => {
      setReview(null)
    }, 60_000)

    return () => clearTimeout(timer)
  }, [review])

  return { review, dismiss }
}
