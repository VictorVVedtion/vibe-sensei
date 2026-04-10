import { useState, useEffect, useCallback } from 'react'
import type { WeeklyReviewData } from '../../shared/ipc-channels'

interface UseWeeklyReviewResult {
  review: WeeklyReviewData | null
  loading: boolean
}

export function useWeeklyReview(): UseWeeklyReviewResult {
  const [review, setReview] = useState<WeeklyReviewData | null>(null)
  const [loading, setLoading] = useState(true)

  const handleReview = useCallback((data: WeeklyReviewData) => {
    setReview(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api) {
      setLoading(false)
      return
    }

    // Request fresh review on mount
    if (typeof api.requestWeeklyReview === 'function') {
      api.requestWeeklyReview()
    }

    // Subscribe to weekly review updates
    let cleanup: (() => void) | undefined
    if (typeof api.onWeeklyReview === 'function') {
      cleanup = api.onWeeklyReview((data: WeeklyReviewData) => {
        handleReview(data)
      })
    }

    // If no response within 500ms, stop loading indicator
    const timeout = setTimeout(() => setLoading(false), 500)

    return () => {
      clearTimeout(timeout)
      if (typeof cleanup === 'function') cleanup()
    }
  }, [handleReview])

  return { review, loading }
}
