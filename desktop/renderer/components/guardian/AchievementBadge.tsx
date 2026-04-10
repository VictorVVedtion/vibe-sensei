import { useEffect, useRef, useState } from 'react'
import type { TradeReviewAchievement } from '../../../shared/ipc-channels'

interface AchievementBadgeProps {
  achievement: TradeReviewAchievement
}

// ── Colors (matching worktree palette) ──────────────────────────────────────

const C = {
  bg: '#0A0F0A',
  bgRaised: '#0D1117',
  border: '#002B0E',
  borderSubtle: '#001A08',
  textDim: '#008F11',
  textBright: '#00FF41',
  yellow: '#FFEA00',
  font: "'JetBrains Mono', monospace",
} as const

/**
 * Achievement badge with toast notification.
 * Shows a 3-second toast animation on mount, then settles into a compact badge.
 */
export function AchievementBadge({ achievement }: AchievementBadgeProps) {
  const [isToast, setIsToast] = useState(true)
  const badgeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = badgeRef.current
    if (!el) return

    el.style.opacity = '0'
    el.style.transform = 'scale(0.8) translateY(-8px)'
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 300ms ease, transform 300ms ease'
      el.style.opacity = '1'
      el.style.transform = 'scale(1) translateY(0)'
    })

    const timer = setTimeout(() => {
      setIsToast(false)
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  if (isToast) {
    return (
      <div ref={badgeRef} style={styles.toastContainer}>
        <div style={styles.toastGlow} />
        <div style={styles.toastContent}>
          <span style={styles.toastIcon}>{achievement.icon}</span>
          <div style={styles.toastText}>
            <span style={styles.toastTitle}>ACHIEVEMENT UNLOCKED</span>
            <span style={styles.toastName}>{achievement.name}</span>
            <span style={styles.toastDesc}>{achievement.description}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.badgeContainer}>
      <span style={styles.badgeIcon}>{achievement.icon}</span>
      <span style={styles.badgeName}>{achievement.name}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  toastContainer: {
    position: 'relative' as const,
    background: C.bg,
    border: `1px solid ${C.yellow}`,
    overflow: 'hidden',
    padding: '8px 8px',
    fontFamily: C.font,
  },
  toastGlow: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    background: `linear-gradient(90deg, transparent, ${C.yellow}, transparent)`,
    animation: 'achievement-glow 2s ease infinite',
  },
  toastContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  toastIcon: {
    fontSize: 20,
    lineHeight: 1,
    flexShrink: 0,
  },
  toastText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    minWidth: 0,
  },
  toastTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: C.yellow,
    letterSpacing: 1,
  },
  toastName: {
    fontSize: 11,
    fontWeight: 700,
    color: C.textBright,
  },
  toastDesc: {
    fontSize: 9,
    color: C.textDim,
  },
  badgeContainer: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: C.bgRaised,
    padding: '1px 4px',
    border: `1px solid ${C.borderSubtle}`,
    fontFamily: C.font,
  },
  badgeIcon: {
    fontSize: 11,
    lineHeight: 1,
  },
  badgeName: {
    fontSize: 9,
    fontWeight: 600,
    color: C.textDim,
  },
}
