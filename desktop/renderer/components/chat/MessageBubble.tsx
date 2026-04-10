/**
 * MessageBubble — renders a single chat message with role-based styling.
 * User messages align right, assistant messages render with guardian avatar
 * and rarity header, system messages centered. Supports markdown rendering
 * and guardian action cards for alert messages.
 */

import type { ChatMessage } from '../../hooks/useChatSocket'
import { GuardianActionCard } from './GuardianActionCard'

interface MessageBubbleProps {
  message: ChatMessage
  onDismiss?: (id: string) => void
  onSendMessage?: (content: string) => void
  masterFallback?: { name: string; rarity?: string } | null
}

// ── Rarity Display ──────────────────────────────────────────────────────────

const RARITY_STARS: Record<string, string> = {
  common: '\u2605',
  uncommon: '\u2605\u2605',
  rare: '\u2605\u2605\u2605',
  epic: '\u2605\u2605\u2605\u2605',
  legendary: '\u2605\u2605\u2605\u2605\u2605',
}

const RARITY_LABELS: Record<string, string> = {
  common: 'COMMON',
  uncommon: 'UNCOMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
}

// ── Default Guardian (fallback when backend doesn't send metadata) ──────────

const DEFAULT_GUARDIAN = {
  masterName: 'VIBE SENSEI',
  masterInitials: 'VS',
  rarity: 'legendary',
}

// ── Markdown Renderer ───────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  // Escape HTML entities first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code blocks (```...```) — must be processed before inline code
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre class="chat-markdown-pre"><code>${code.trim()}</code></pre>`
  })

  // Inline code (`...`)
  html = html.replace(/`([^`\n]+)`/g, '<code class="chat-markdown-code">$1</code>')

  // Bold (**...**)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  // Italic (*...*)
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  return html
}

// ── Component ───────────────────────────────────────────────────────────────

export function MessageBubble({ message, onDismiss, onSendMessage, masterFallback }: MessageBubbleProps) {
  const { role, content, isStreaming, isError, toolUse, guardianAlert, guardianMeta } = message

  // Guardian action card rendering
  if (guardianAlert) {
    return (
      <div className="chat-bubble chat-bubble--system">
        <GuardianActionCard
          alert={guardianAlert}
          onAccept={() => onDismiss?.(message.id)}
          onOverride={() => {
            console.log('[guardian-override]', guardianAlert.message)
            onDismiss?.(message.id)
          }}
          onDebate={() => {
            onSendMessage?.(`Start a debate about this alert: ${guardianAlert.message}`)
            onDismiss?.(message.id)
          }}
        />
      </div>
    )
  }

  // Guardian-style assistant message
  if (role === 'assistant') {
    const masterMeta = masterFallback ? {
      masterName: masterFallback.name,
      masterInitials: masterFallback.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
      rarity: masterFallback.rarity ?? 'legendary',
    } : DEFAULT_GUARDIAN
    const meta = guardianMeta ?? masterMeta
    const name = meta.masterName ?? DEFAULT_GUARDIAN.masterName
    const initials = meta.masterInitials ?? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    const rarity = meta.rarity ?? DEFAULT_GUARDIAN.rarity
    const stars = RARITY_STARS[rarity] ?? RARITY_STARS.legendary
    const rarityLabel = RARITY_LABELS[rarity] ?? RARITY_LABELS.legendary

    const streamingClass = isStreaming ? 'chat-bubble--streaming' : ''
    const errorClass = isError ? 'chat-bubble--error' : ''
    const displayContent = content || (isStreaming ? '' : '\u00A0')

    return (
      <div className={`chat-bubble--guardian ${streamingClass} ${errorClass}`}>
        <div className="chat-avatar">
          <span className="chat-avatar-initials">{initials}</span>
        </div>
        <div className="chat-guardian-content">
          <div className="chat-guardian-header">
            {name} <span className="chat-guardian-rarity">{stars} {rarityLabel}</span>
          </div>
          <div className={isStreaming ? 'chat-streaming-container' : undefined}>
            <div
              className="chat-guardian-body chat-markdown"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(displayContent) }}
            />
          </div>
        </div>
      </div>
    )
  }

  // User and system messages
  const roleClass =
    role === 'user' ? 'chat-bubble--user' : 'chat-bubble--system'

  const extraClass = [
    isError ? 'chat-bubble--error' : '',
    toolUse ? 'chat-bubble--tool' : '',
    isStreaming ? 'chat-bubble--streaming' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={`chat-bubble ${roleClass} ${extraClass}`}>
      {toolUse ? (
        <ToolUseContent name={toolUse.name} input={toolUse.input} />
      ) : (
        <div className={isStreaming ? 'chat-streaming-container' : undefined}>
          <div
            className="chat-markdown"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content || (isStreaming ? '' : '\u00A0')) }}
          />
        </div>
      )}
    </div>
  )
}

function ToolUseContent({ name, input }: { name: string; input: unknown }) {
  const inputStr = typeof input === 'object'
    ? Object.entries(input as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    : String(input)

  return (
    <>
      <span style={{ fontWeight: 600 }}>{name}</span>
      {inputStr && (
        <span style={{ opacity: 0.7 }}> ({inputStr})</span>
      )}
    </>
  )
}
