/**
 * ChatPanel — replaces TerminalPanel as the main interaction surface.
 * Connects to /ws/chat via useChatSocket, renders messages as styled
 * bubbles, streams AI responses token-by-token.
 */

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useChatSocket, type ChatMessage, type ConnectionStatus } from '../../hooks/useChatSocket'
import { useTradingState } from '../../hooks/useTradingState'
import { InputBar, type InputBarHandle } from './InputBar'
import { MessageBubble } from './MessageBubble'
import { CompanionOverlay } from '../companion/CompanionOverlay'
import '../../styles/chat.css'

interface ChatPanelProps {
  port: number | null
}

export interface ChatPanelHandle {
  sendMessage: (msg: string) => void
  prefillInput: (text: string) => void
}

export const ChatPanel = forwardRef<ChatPanelHandle, ChatPanelProps>(function ChatPanel({ port }, ref) {
  const { messages, status, sendMessage, abort, clearMessages, dismissMessage } = useChatSocket(port)
  const { master } = useTradingState()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputBarRef = useRef<InputBarHandle>(null)

  useImperativeHandle(ref, () => ({
    sendMessage,
    prefillInput(text: string) {
      inputBarRef.current?.prefillInput(text)
    },
  }), [sendMessage])

  const isStreaming = messages.some(m => m.isStreaming)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="chat-root">
      <ChatHeader status={status} messageCount={messages.length} onClear={clearMessages} />

      {messages.length === 0 ? (
        <div className="chat-empty">
          <div className="chat-empty-icon">{'>'}_</div>
          <div>Ask anything about markets, or execute a trade.</div>
          <div className="chat-empty-hint">
            Try: "What's the BTC trend?" or "Buy 0.1 ETH"
          </div>
        </div>
      ) : (
        <div className="chat-messages">
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onDismiss={dismissMessage}
              onSendMessage={sendMessage}
              masterFallback={master}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      <InputBar
        ref={inputBarRef}
        onSend={sendMessage}
        onAbort={abort}
        isStreaming={isStreaming}
        disabled={status !== 'connected'}
      />
      <CompanionOverlay />
    </div>
  )
})

/** Operator-style chat header bar with connection status */
function ChatHeader({
  status,
  messageCount,
  onClear,
}: {
  status: ConnectionStatus
  messageCount: number
  onClear: () => void
}) {
  const statusLabel =
    status === 'connected' ? 'ONLINE' :
    status === 'connecting' ? 'CONNECTING...' :
    status === 'reconnecting' ? 'RECONNECTING...' :
    'OFFLINE'

  return (
    <div className="chat-header">
      <span className="chat-header-label">[AI_CHAT]</span>
      {status === 'connected' && (
        <span style={{ fontSize: 9, color: 'var(--outline)', letterSpacing: '0.05em' }}>
          Cmd+/ toggle | Cmd+K commands
        </span>
      )}
      <span className={`chat-header-status chat-header-status--${status}`} style={{ marginLeft: 'auto' }}>
        {statusLabel}
      </span>
      {messageCount > 0 && (
        <button
          onClick={onClear}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--on-surface-variant)',
            fontFamily: 'var(--font-body)',
            fontSize: 10,
            cursor: 'pointer',
            padding: '2px 6px',
            opacity: 0.6,
          }}
          title="Clear chat"
          aria-label="Clear chat messages"
        >
          CLEAR
        </button>
      )}
    </div>
  )
}
