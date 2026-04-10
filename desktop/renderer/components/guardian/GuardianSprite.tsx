import { useState, useEffect, useRef } from 'react'
import { getSpritePath, getAllSpritePaths } from '../companion/sprite-map'

type SpriteState = 'idle' | 'active' | 'happy' | 'worried' | 'alert' | 'celebrate'

interface GuardianSpriteProps {
  masterId: string
  state: SpriteState
  size?: number
  quote?: string
}

/**
 * Probe whether the idle PNG for this master exists.
 * Returns a ref-like { ready, exists } that updates once the probe completes.
 * Sprites served from Vite `publicDir: ../assets` → `/sprites/*.png`.
 */
function useSpriteProbe(masterId: string) {
  const [exists, setExists] = useState(true) // optimistic — assume yes
  useEffect(() => {
    const probe = new Image()
    probe.src = getSpritePath(masterId, 'idle')
    probe.onload = () => setExists(true)
    probe.onerror = () => setExists(false)
    // Preload other states in the background
    for (const path of getAllSpritePaths(masterId)) {
      const img = new Image()
      img.src = path
    }
  }, [masterId])
  return exists
}

export function GuardianSprite({ masterId, state, size = 120, quote }: GuardianSpriteProps) {
  const [currentState, setCurrentState] = useState<SpriteState>(state)
  const [prevState, setPrevState] = useState<SpriteState>(state)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showBubble, setShowBubble] = useState(false)
  const [bubbleText, setBubbleText] = useState('')
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const spriteExists = useSpriteProbe(masterId)

  // State transition with crossfade
  useEffect(() => {
    if (state !== currentState) {
      setPrevState(currentState)
      setIsTransitioning(true)
      const t = setTimeout(() => {
        setCurrentState(state)
        setIsTransitioning(false)
      }, 200)
      return () => clearTimeout(t)
    }
  }, [state])

  // Auto-return to idle after non-idle states
  useEffect(() => {
    if (currentState !== 'idle' && currentState !== 'active') {
      idleTimerRef.current = setTimeout(() => {
        setPrevState(currentState)
        setIsTransitioning(true)
        setTimeout(() => {
          setCurrentState('idle')
          setIsTransitioning(false)
        }, 200)
      }, 4000)
      return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current) }
    }
  }, [currentState])

  // Speech bubble with typewriter
  useEffect(() => {
    if (!quote) return
    setShowBubble(true)
    setBubbleText('')
    let i = 0
    const type = () => {
      if (i < quote.length) {
        setBubbleText(quote.slice(0, i + 1))
        i++
        const delay = Math.random() < 0.05 ? 120 : Math.random() < 0.15 ? 60 : 30
        bubbleTimerRef.current = setTimeout(type, delay)
      } else {
        bubbleTimerRef.current = setTimeout(() => setShowBubble(false), 5000)
      }
    }
    bubbleTimerRef.current = setTimeout(type, 300)
    return () => { if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current) }
  }, [quote])

  const currentUrl = getSpritePath(masterId, currentState)
  const prevUrl = isTransitioning ? getSpritePath(masterId, prevState) : null

  // Pick breathing animation based on state
  const breathingClass = currentState === 'idle' ? 'sprite-breathing'
    : currentState === 'active' ? 'sprite-working'
    : currentState === 'celebrate' ? 'sprite-bouncing'
    : currentState === 'alert' ? 'sprite-shaking'
    : currentState === 'worried' ? 'sprite-swaying'
    : 'sprite-breathing'

  // Initials fallback when the sprite PNG is missing.
  // Matches the square Matrix-aesthetic treatment so the card doesn't look broken.
  if (!spriteExists) {
    const initials = masterId
      .split('_')
      .map(w => w[0]?.toUpperCase() ?? '')
      .slice(0, 2)
      .join('')
    return (
      <div style={{ ...styles.wrapper, height: size + 48 }}>
        <div
          className={breathingClass}
          style={{
            ...styles.spriteContainer,
            ...styles.spriteClipBox,
            width: size,
            height: size,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{
            fontSize: Math.round(size * 0.35),
            fontWeight: 700,
            color: 'var(--primary, #9cff93)',
            fontFamily: 'var(--font-body, monospace)',
            letterSpacing: '1px',
            userSelect: 'none',
          }}>{initials}</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...styles.wrapper, height: size + 48 }}>
      {/* Speech bubble */}
      {showBubble && bubbleText && (
        <div style={styles.bubble}>
          <span style={styles.bubbleText}>{bubbleText}</span>
          <div style={styles.bubbleTail} />
        </div>
      )}

      {/* Sprite container */}
      <div
        className={breathingClass}
        style={{ ...styles.spriteContainer, width: size, height: size }}
      >
        {/* Shadow/glow underneath — lives outside the clip box so it can overflow */}
        <div style={{
          ...styles.shadow,
          background: currentState === 'alert' ? 'rgba(242, 54, 69, 0.15)'
            : currentState === 'happy' || currentState === 'celebrate' ? 'rgba(8, 153, 129, 0.15)'
            : 'rgba(156, 255, 147, 0.08)',
        }} />

        {/* Clip box — dark bg + overflow:hidden hides the baked checker padding
            that all current sprite JPEGs carry around the character. */}
        <div style={{ ...styles.spriteClipBox, width: size, height: size }}>
          {/* Previous state (fading out during transition) */}
          {prevUrl && isTransitioning && (
            <img
              src={prevUrl}
              alt=""
              style={{
                ...styles.sprite,
                opacity: 0,
                transition: 'opacity 200ms ease-out',
              }}
            />
          )}

          {/* Current state */}
          {currentUrl && (
            <img
              src={currentUrl}
              alt={`${masterId} ${currentState}`}
              style={{
                ...styles.sprite,
                opacity: isTransitioning ? 0 : 1,
                transition: 'opacity 200ms ease-in',
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  spriteContainer: {
    position: 'relative',
    imageRendering: 'pixelated' as any,
  },
  spriteClipBox: {
    position: 'relative',
    background: 'var(--surface-container-high, #1f1f1f)',
    border: '1px solid var(--outline-variant, #484848)',
    boxShadow: 'inset 0 0 0 1px rgba(156, 255, 147, 0.08)',
    overflow: 'hidden',
  },
  sprite: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    // Zoom in to crop ~10% off each edge, hiding most of the generator's
    // checker padding. Safe because characters occupy the middle ~70%.
    transform: 'scale(1.2)',
    imageRendering: 'pixelated' as any,
    pointerEvents: 'none',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
  },
  shadow: {
    position: 'absolute',
    bottom: -4,
    left: '15%',
    right: '15%',
    height: 8,
    borderRadius: '50%',
    filter: 'blur(4px)',
    zIndex: 0,
  },
  bubble: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(30, 34, 45, 0.95)',
    border: '1px solid var(--border-base)',
    borderRadius: 8,
    padding: '6px 10px',
    maxWidth: 200,
    marginBottom: 8,
    backdropFilter: 'blur(8px)',
    animation: 'bubble-in 0.3s cubic-bezier(0.34, 1.08, 0.64, 1)',
    zIndex: 10,
  },
  bubbleText: {
    fontFamily: 'var(--font-ui)',
    fontSize: 11,
    color: 'var(--text-primary)',
    lineHeight: 1.4,
    display: 'block',
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: '6px solid rgba(30, 34, 45, 0.95)',
  },
}
