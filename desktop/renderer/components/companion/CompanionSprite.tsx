import { useEffect, useRef, useState } from 'react'
import type { CompanionEmotionState } from '../../hooks/useCompanionState'
import { getSpritePath, getAllSpritePaths } from './sprite-map'

interface CompanionSpriteProps {
  masterId: string
  emotion: CompanionEmotionState
  isNightMode: boolean
  isGhost: boolean
  isATH: boolean
}

/** Crossfade duration in milliseconds. */
const CROSSFADE_MS = 400

/**
 * Manages sprite crossfade between emotion states.
 * Preloads all PNG variants on mount / master change.
 */
function useCrossfade(masterId: string, emotion: CompanionEmotionState) {
  const [frontSrc, setFrontSrc] = useState(() => getSpritePath(masterId, emotion))
  const [backSrc, setBackSrc] = useState(frontSrc)
  const [showBack, setShowBack] = useState(false)
  const [spriteAvailable, setSpriteAvailable] = useState(true)

  useEffect(() => {
    // Probe the idle sprite to check if this master has assets
    const probe = new Image()
    probe.src = getSpritePath(masterId, 'idle')
    probe.onload = () => setSpriteAvailable(true)
    probe.onerror = () => setSpriteAvailable(false)

    const paths = getAllSpritePaths(masterId)
    for (const path of paths) {
      const img = new Image()
      img.src = path
    }
  }, [masterId])

  useEffect(() => {
    const newSrc = getSpritePath(masterId, emotion)
    if (newSrc === frontSrc) return

    setBackSrc(newSrc)
    setShowBack(true)

    const timer = setTimeout(() => {
      setFrontSrc(newSrc)
      setShowBack(false)
    }, CROSSFADE_MS)

    return () => clearTimeout(timer)
  }, [masterId, emotion, frontSrc])

  return { frontSrc, backSrc, showBack, spriteAvailable }
}

/**
 * Schedules random micro-interactions: blink and head tilt.
 */
function useMicroAnimations() {
  const blinkRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tiltRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isBlinking, setIsBlinking] = useState(false)
  const [isTilting, setIsTilting] = useState(false)

  useEffect(() => {
    function scheduleBlink() {
      const delay = 4000 + Math.random() * 4000
      blinkRef.current = setTimeout(() => {
        setIsBlinking(true)
        setTimeout(() => {
          setIsBlinking(false)
          scheduleBlink()
        }, 120)
      }, delay)
    }
    scheduleBlink()
    return () => {
      if (blinkRef.current !== null) clearTimeout(blinkRef.current)
    }
  }, [])

  useEffect(() => {
    function scheduleTilt() {
      const delay = 15000 + Math.random() * 10000
      tiltRef.current = setTimeout(() => {
        setIsTilting(true)
        setTimeout(() => {
          setIsTilting(false)
          scheduleTilt()
        }, 800)
      }, delay)
    }
    scheduleTilt()
    return () => {
      if (tiltRef.current !== null) clearTimeout(tiltRef.current)
    }
  }, [])

  return { isBlinking, isTilting }
}

/**
 * CompanionSprite — animated dual-img crossfade with breathing, blink, and tilt.
 */
export function CompanionSprite({
  masterId,
  emotion,
  isNightMode,
  isGhost,
  isATH,
}: CompanionSpriteProps) {
  const { frontSrc, backSrc, showBack, spriteAvailable } = useCrossfade(masterId, emotion)
  const { isBlinking, isTilting } = useMicroAnimations()

  const nightFilter = isNightMode ? 'brightness(0.6) saturate(0.5)' : ''
  const ghostFilter = isGhost ? 'brightness(0.4) saturate(0.3)' : ''
  const combinedFilter = [nightFilter, ghostFilter].filter(Boolean).join(' ') || 'none'

  const blinkTransform = isBlinking ? 'scaleY(0.1)' : ''
  const tiltTransform = isTilting ? 'rotate(2deg)' : ''
  const animation = isGhost
    ? 'companion-flicker 3s infinite, companion-breathe 3.5s ease-in-out infinite'
    : 'companion-breathe 3.5s ease-in-out infinite'

  // Fallback: show initials when sprite file doesn't exist
  if (!spriteAvailable) {
    const initials = masterId
      .split('_')
      .map(w => w[0]?.toUpperCase() ?? '')
      .slice(0, 2)
      .join('')
    return (
      <div style={containerStyle}>
        <div style={{
          ...spriteWrapperStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: combinedFilter,
          animation,
        }}>
          <span style={{
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--primary, #9cff93)',
            fontFamily: 'var(--font-body, monospace)',
            letterSpacing: '0.5px',
            userSelect: 'none',
          }}>{initials}</span>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {isATH && <ATHParticles />}
      <div
        style={{
          ...spriteWrapperStyle,
          filter: combinedFilter,
          animation,
          transform: [blinkTransform, tiltTransform].filter(Boolean).join(' ') || undefined,
          transition: 'transform 120ms ease',
        }}
      >
        <img
          src={frontSrc}
          alt="Guardian companion"
          style={{ ...spriteImgStyle, opacity: showBack ? 0 : 1 }}
          draggable={false}
        />
        <img
          src={backSrc}
          alt=""
          style={{ ...spriteImgStyle, opacity: showBack ? 1 : 0 }}
          draggable={false}
        />
      </div>
    </div>
  )
}

/** ATH celebration particles — gold dots rising from the sprite. */
function ATHParticles() {
  const particles = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    left: 10 + Math.random() * 60,
    delay: Math.random() * 1.5,
    size: 3 + Math.random() * 3,
  }))

  return (
    <div style={particlesContainerStyle}>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute' as const,
            left: `${p.left}%`,
            bottom: 0,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: 'var(--rarity-legendary)',
            animation: `companion-particles 3s ease-out ${p.delay}s both`,
          }}
        />
      ))}
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  position: 'relative',
  width: 80,
  height: 80,
  flexShrink: 0,
}

// Square Matrix-aesthetic container. The dark background + overflow:hidden +
// inner scale on the <img> together hide the baked checker/alpha padding that
// all current sprite JPEGs carry around the character (generator artifact).
const spriteWrapperStyle: React.CSSProperties = {
  position: 'relative',
  width: 80,
  height: 80,
  background: 'var(--surface-container-high, #1f1f1f)',
  border: '1px solid var(--outline-variant, #484848)',
  overflow: 'hidden',
  boxShadow: 'inset 0 0 0 1px rgba(156, 255, 147, 0.08)',
}

const spriteImgStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center center',
  // Zoom in to crop ~10% off each edge, hiding most of the generator's checker
  // padding. Safe because characters are centered and occupy the middle ~70%.
  transform: 'scale(1.2)',
  imageRendering: 'pixelated',
  transition: `opacity ${CROSSFADE_MS}ms ease`,
  userSelect: 'none',
  pointerEvents: 'none',
}

const particlesContainerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  overflow: 'visible',
  zIndex: 1,
}
