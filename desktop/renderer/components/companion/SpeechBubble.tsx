import { useState, useEffect } from 'react'
import type { SpeechMessage, SpeechSeverity } from '../../hooks/useSpeechQueue'

interface SpeechBubbleProps {
  message: SpeechMessage
  onDismiss: () => void
}

/** Severity → border color using tokens.css variables. */
const SEVERITY_BORDER: Record<SpeechSeverity, string> = {
  normal: 'var(--border-strong)',
  warning: 'var(--color-warning)',
  critical: 'var(--color-loss)',
  celebrate: 'var(--color-profit)',
}

/** Severity → text accent color. */
const SEVERITY_ACCENT: Record<SpeechSeverity, string> = {
  normal: 'var(--text-primary)',
  warning: 'var(--color-warning)',
  critical: 'var(--color-loss)',
  celebrate: 'var(--color-profit)',
}

/**
 * SpeechBubble — displays a companion speech message with severity styling.
 *
 * Features:
 * - 4 severity visual styles (border + accent color)
 * - CSS ::after tail pointing down to sprite
 * - Click to dismiss
 * - Fade-in animation on mount
 * - Night mode softens border colors
 */
export function SpeechBubble({ message, onDismiss }: SpeechBubbleProps) {
  const [visible, setVisible] = useState(false)

  // Trigger entrance animation
  useEffect(() => {
    const timer = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(timer)
  }, [message.id])

  const borderColor = SEVERITY_BORDER[message.severity]
  const accentColor = SEVERITY_ACCENT[message.severity]

  return (
    <div
      onClick={onDismiss}
      style={{
        ...bubbleStyle,
        borderColor,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(4px) scale(0.95)',
      }}
      role="status"
      aria-live="polite"
    >
      {/* Master name label */}
      <div style={{ ...masterNameStyle, color: accentColor }}>
        {message.masterName}
      </div>

      {/* Message text */}
      <div style={messageTextStyle}>
        {message.text}
      </div>

      {/* Tail pointing down to sprite */}
      <div style={{ ...tailStyle, borderTopColor: borderColor }} />
      <div style={tailInnerStyle} />
    </div>
  )
}

const bubbleStyle: React.CSSProperties = {
  position: 'relative',
  maxWidth: 240,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-lg)',
  padding: '8px 10px',
  cursor: 'pointer',
  transition: 'opacity 200ms ease, transform 200ms ease',
  marginBottom: 6,
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
}

const masterNameStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.3,
  marginBottom: 3,
  textTransform: 'uppercase' as const,
}

const messageTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
  color: 'var(--text-primary)',
  lineHeight: 1.4,
  wordWrap: 'break-word' as const,
  overflowWrap: 'break-word' as const,
}

const tailStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: -7,
  left: 16,
  width: 0,
  height: 0,
  borderLeft: '6px solid transparent',
  borderRight: '6px solid transparent',
  borderTop: '7px solid var(--border-strong)',
}

const tailInnerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: -5,
  left: 17,
  width: 0,
  height: 0,
  borderLeft: '5px solid transparent',
  borderRight: '5px solid transparent',
  borderTop: '6px solid var(--bg-surface)',
}
