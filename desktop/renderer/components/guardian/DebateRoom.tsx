import { useEffect, useState, useRef, useCallback } from 'react'
import type { CouncilDebate, CouncilParticipant, CouncilRecommendation } from '../../../shared/ipc-channels'

// ── Constants ─────────────────────────────────────────────────────────────

/** Auto-dismiss after 30 seconds. */
const AUTO_DISMISS_MS = 30_000

/** Fade-out animation duration. */
const FADE_OUT_MS = 400

// ── Recommendation Badge Config ───────────────────────────────────────────

const RECOMMENDATION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  reduce: {
    label: 'REDUCE',
    color: 'var(--color-loss)',
    bg: 'rgba(242, 54, 69, 0.12)',
  },
  hold: {
    label: 'HOLD',
    color: 'var(--color-warning)',
    bg: 'rgba(247, 147, 26, 0.12)',
  },
  watch: {
    label: 'WATCH',
    color: 'var(--color-info)',
    bg: 'rgba(41, 98, 255, 0.12)',
  },
}

// ── Sprite Helper ─────────────────────────────────────────────────────────

/**
 * Resolve a sprite portrait path from a spriteId.
 * Falls back to the idle expression if the specific file doesn't exist.
 */
function getSpritePath(spriteId?: string): string | null {
  if (!spriteId) return null
  // Use the alert expression for debates — matches the serious tone
  return `../../assets/sprites/${spriteId}-alert.png`
}

// ── Component ─────────────────────────────────────────────────────────────

export function DebateRoom() {
  const [debate, setDebate] = useState<CouncilDebate | null>(null)
  const [visible, setVisible] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    setFadingOut(true)
    setTimeout(() => {
      setVisible(false)
      setFadingOut(false)
      setDebate(null)
    }, FADE_OUT_MS)
  }, [])

  // Subscribe to council debate IPC
  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api || typeof api.onCouncilDebate !== 'function') return

    const cleanup = api.onCouncilDebate((data: CouncilDebate) => {
      // Clear any pending dismiss timer
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current)
      }

      setDebate(data)
      setVisible(true)
      setFadingOut(false)

      // Auto-dismiss after 30 seconds
      dismissTimer.current = setTimeout(() => {
        dismiss()
      }, AUTO_DISMISS_MS)
    })

    return () => {
      if (typeof cleanup === 'function') cleanup()
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
    }
  }, [dismiss])

  if (!visible || !debate) return null

  // Split participants into FOR and AGAINST sides
  const forSide = debate.participants.filter((p) => p.position === 'for')
  const againstSide = debate.participants.filter((p) => p.position === 'against')
  const neutralSide = debate.participants.filter((p) => p.position === 'neutral')

  const recommendation = (debate as any).recommendation as CouncilRecommendation | undefined
  const source = (debate as any).source as string | undefined
  const recConfig = recommendation ? RECOMMENDATION_CONFIG[recommendation] : null

  return (
    <div
      style={{
        ...styles.overlay,
        opacity: fadingOut ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease`,
      }}
      onClick={dismiss}
    >
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.headerIcon}>
              {source === 'council' ? '\u2696' : '\u2694'}
            </span>
            <span style={styles.headerTitle}>
              {source === 'council' ? 'COUNCIL DEBATE' : 'GUARDIAN DEBATE'}
            </span>
          </div>
          <button style={styles.closeBtn} onClick={dismiss} aria-label="Dismiss">
            \u2715
          </button>
        </div>

        {/* Topic */}
        <div style={styles.topic}>{debate.topic}</div>

        {/* Debate Columns */}
        <div style={styles.columns}>
          {/* FOR side */}
          <div style={styles.column}>
            <div style={styles.columnHeader}>
              <span style={{ ...styles.positionBadge, ...styles.forBadge }}>FOR</span>
            </div>
            {forSide.map((p, i) => (
              <ParticipantCard key={`for-${i}`} participant={p} position="for" />
            ))}
          </div>

          {/* Divider */}
          <div style={styles.columnDivider} />

          {/* AGAINST side */}
          <div style={styles.column}>
            <div style={styles.columnHeader}>
              <span style={{ ...styles.positionBadge, ...styles.againstBadge }}>AGAINST</span>
            </div>
            {againstSide.map((p, i) => (
              <ParticipantCard key={`against-${i}`} participant={p} position="against" />
            ))}
          </div>
        </div>

        {/* Neutral participants (if any) */}
        {neutralSide.length > 0 && (
          <div style={styles.neutralSection}>
            {neutralSide.map((p, i) => (
              <ParticipantCard key={`neutral-${i}`} participant={p} position="neutral" />
            ))}
          </div>
        )}

        {/* Footer: Verdict + Recommendation Badge */}
        <div style={styles.footer}>
          {debate.verdict && (
            <span style={styles.verdict}>{debate.verdict}</span>
          )}
          {recConfig && (
            <span
              style={{
                ...styles.recBadge,
                color: recConfig.color,
                background: recConfig.bg,
                borderColor: recConfig.color,
              }}
            >
              {recConfig.label}
            </span>
          )}
        </div>

        {/* Auto-dismiss indicator */}
        <div style={styles.timerBar}>
          <div
            style={{
              ...styles.timerFill,
              animation: `debate-timer ${AUTO_DISMISS_MS}ms linear forwards`,
            }}
          />
        </div>
      </div>

      {/* Timer animation keyframes */}
      <style>{`
        @keyframes debate-timer {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  )
}

// ── Participant Card ──────────────────────────────────────────────────────

function ParticipantCard({
  participant,
  position,
}: {
  participant: CouncilParticipant
  position: 'for' | 'against' | 'neutral'
}) {
  const spriteId = (participant as any).spriteId as string | undefined
  const spritePath = getSpritePath(spriteId)
  const [spriteError, setSpriteError] = useState(false)

  const accentColor =
    position === 'for'
      ? 'var(--color-profit)'
      : position === 'against'
        ? 'var(--color-loss)'
        : 'var(--color-info)'

  return (
    <div style={styles.participantCard}>
      {/* Portrait */}
      <div style={styles.portraitContainer}>
        {spritePath && !spriteError ? (
          <img
            src={spritePath}
            alt={participant.masterName}
            style={styles.portrait}
            onError={() => setSpriteError(true)}
          />
        ) : (
          <div style={styles.portraitFallback}>
            <span style={styles.portraitInitial}>
              {participant.masterName.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Name + Argument */}
      <div style={styles.participantContent}>
        <span style={{ ...styles.participantName, color: accentColor }}>
          {participant.masterName}
        </span>
        <span style={styles.participantArgument}>
          &ldquo;{participant.argument}&rdquo;
        </span>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(2px)',
  },
  card: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-lg)',
    width: '90%',
    maxWidth: 640,
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: 'var(--bg-raised)',
    borderBottom: '1px solid var(--border-base)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 14,
  },
  headerTitle: {
    fontFamily: 'var(--font-ui)',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    fontSize: 14,
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-ui)',
    transition: 'color var(--transition-fast)',
  },
  topic: {
    padding: '12px 16px 8px',
    fontFamily: 'var(--font-ui)',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    lineHeight: 1.4,
  },
  columns: {
    display: 'flex',
    padding: '0 16px 12px',
    gap: 0,
    minHeight: 0,
  },
  column: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    minWidth: 0,
  },
  columnDivider: {
    width: 1,
    background: 'var(--border-base)',
    margin: '0 12px',
    flexShrink: 0,
  },
  columnHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 4,
  },
  positionBadge: {
    fontFamily: 'var(--font-ui)',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1,
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    textTransform: 'uppercase' as const,
  },
  forBadge: {
    color: 'var(--color-profit)',
    background: 'rgba(8, 153, 129, 0.12)',
  },
  againstBadge: {
    color: 'var(--color-loss)',
    background: 'rgba(242, 54, 69, 0.12)',
  },
  neutralSection: {
    padding: '0 16px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  participantCard: {
    display: 'flex',
    gap: 10,
    padding: 8,
    background: 'var(--bg-raised)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
  },
  portraitContainer: {
    width: 40,
    height: 40,
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    flexShrink: 0,
    background: 'var(--bg-inset)',
    border: '1px solid var(--border-base)',
  },
  portrait: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    imageRendering: 'pixelated' as const,
  },
  portraitFallback: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-inset)',
  },
  portraitInitial: {
    fontFamily: 'var(--font-mono)',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-tertiary)',
  },
  participantContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
    minWidth: 0,
    flex: 1,
  },
  participantName: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    fontWeight: 700,
  },
  participantArgument: {
    fontFamily: 'var(--font-ui)',
    fontSize: 11,
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    fontStyle: 'italic',
    wordBreak: 'break-word' as const,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    borderTop: '1px solid var(--border-base)',
    background: 'var(--bg-raised)',
    gap: 12,
  },
  verdict: {
    fontFamily: 'var(--font-ui)',
    fontSize: 11,
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    flex: 1,
    minWidth: 0,
  },
  recBadge: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    padding: '4px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid',
    flexShrink: 0,
    textTransform: 'uppercase' as const,
  },
  timerBar: {
    height: 2,
    background: 'var(--bg-inset)',
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    background: 'var(--color-accent)',
    opacity: 0.4,
  },
}
