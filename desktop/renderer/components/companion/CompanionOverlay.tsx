import { useState, useCallback } from 'react'
import { CompanionSprite } from './CompanionSprite'
import { SpeechBubble } from './SpeechBubble'
import { CompanionTooltip } from './CompanionTooltip'
import { useCompanionState } from '../../hooks/useCompanionState'
import type { CompanionEmotionState } from '../../hooks/useCompanionState'
import { useSpeechQueue } from '../../hooks/useSpeechQueue'
import { useTradingState } from '../../hooks/useTradingState'
import type { SpeechMessage } from '../../hooks/useSpeechQueue'
import './companion.css'

/** Preset positions for the companion overlay. */
type CompanionPosition = 'bottom-left' | 'bottom-right' | 'top-left'

const POSITIONS: CompanionPosition[] = ['bottom-left', 'bottom-right', 'top-left']

/** CSS positioning for each preset. */
const POSITION_STYLES: Record<CompanionPosition, React.CSSProperties> = {
  'bottom-left': { bottom: 12, left: 12 },
  'bottom-right': { bottom: 12, right: 12 },
  'top-left': { top: 12, left: 12 },
}

/**
 * CompanionOverlay — root container for the living companion sprite.
 *
 * Renders the sprite, speech bubble, tooltip, and position toggle.
 * Subscribes to trading state + guardian master for emotion/speech data.
 * Position cycles between bottom-left, bottom-right, top-left via toggle.
 */
export function CompanionOverlay() {
  const { state, master } = useTradingState()
  const { currentMessage, dismiss } = useSpeechQueue()
  const [position, setPosition] = useState<CompanionPosition>('bottom-left')
  const [showTooltip, setShowTooltip] = useState(false)

  const masterId = master?.id ?? null
  const { emotion, isATH, isNightMode, isGhost } = useCompanionState(
    masterId,
    state.totalPortfolioValue,
  )

  const cyclePosition = useCallback(() => {
    setPosition((prev) => {
      const idx = POSITIONS.indexOf(prev)
      return POSITIONS[(idx + 1) % POSITIONS.length]!
    })
  }, [])

  if (!masterId) return null

  return (
    <div
      style={{ ...overlayContainerStyle, ...POSITION_STYLES[position] }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <CompanionContent
        masterId={masterId}
        emotion={emotion}
        isNightMode={isNightMode}
        isGhost={isGhost}
        isATH={isATH}
        position={position}
        currentMessage={currentMessage}
        dismiss={dismiss}
        showTooltip={showTooltip}
      />
      <ToggleButton onClick={cyclePosition} visible={showTooltip} />
    </div>
  )
}

/** Inner content: sprite + speech bubble + tooltip, position-aware layout. */
function CompanionContent({
  masterId,
  emotion,
  isNightMode,
  isGhost,
  isATH,
  position,
  currentMessage,
  dismiss,
  showTooltip,
}: {
  masterId: string
  emotion: CompanionEmotionState
  isNightMode: boolean
  isGhost: boolean
  isATH: boolean
  position: CompanionPosition
  currentMessage: SpeechMessage | null
  dismiss: () => void
  showTooltip: boolean
}) {
  const isTop = position === 'top-left'
  const showBubble = currentMessage !== null

  return (
    <>
      {!isTop && showBubble && (
        <SpeechBubble message={currentMessage} onDismiss={dismiss} />
      )}
      <CompanionSprite
        masterId={masterId}
        emotion={emotion}
        isNightMode={isNightMode}
        isGhost={isGhost}
        isATH={isATH}
      />
      {isTop && showBubble && (
        <SpeechBubble message={currentMessage} onDismiss={dismiss} />
      )}
      <CompanionTooltip visible={showTooltip && !showBubble} />
    </>
  )
}

/** Position toggle button — appears on hover. */
function ToggleButton({ onClick, visible }: { onClick: () => void; visible: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{ ...toggleButtonStyle, opacity: visible ? 0.7 : 0 }}
      title="Move companion"
      aria-label="Move companion position"
    >
      <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
        <circle cx="2" cy="2" r="1" />
        <circle cx="6" cy="2" r="1" />
        <circle cx="2" cy="6" r="1" />
        <circle cx="6" cy="6" r="1" />
      </svg>
    </button>
  )
}

const overlayContainerStyle: React.CSSProperties = {
  position: 'absolute',
  zIndex: 20,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 0,
  pointerEvents: 'auto',
}

const toggleButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: -4,
  right: -4,
  width: 16,
  height: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg-raised)',
  border: '1px solid var(--border-base)',
  borderRadius: '50%',
  color: 'var(--text-tertiary)',
  cursor: 'pointer',
  padding: 0,
  opacity: 0,
  transition: 'opacity var(--transition-fast)',
}
