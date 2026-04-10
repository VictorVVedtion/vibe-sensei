import { useState, useEffect, useCallback } from 'react'
import type { PlaybookCardData } from '../components/guardian/PlaybookCard'

interface UsePlaybookCardResult {
  card: PlaybookCardData | null
  dismiss: () => void
}

export function usePlaybookCard(): UsePlaybookCardResult {
  const [card, setCard] = useState<PlaybookCardData | null>(null)

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api) return

    let cleanup: (() => void) | undefined
    if (typeof api.onPlaybookCard === 'function') {
      cleanup = api.onPlaybookCard((data: PlaybookCardData) => {
        setCard(data)
      })
    }

    return () => {
      if (typeof cleanup === 'function') cleanup()
    }
  }, [])

  const dismiss = useCallback(() => {
    setCard(null)
  }, [])

  return { card, dismiss }
}
