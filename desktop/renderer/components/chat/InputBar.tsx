/**
 * InputBar — multi-line chat input with send/abort controls.
 * Enter sends, Shift+Enter for newline, Escape to abort streaming.
 * Trade commands (/buy, /sell, /swap) trigger a CommandPreview card
 * before execution for user confirmation.
 * Slash commands show an autocomplete dropdown above the input.
 */

import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { CommandPreview, isTradeCommand } from './CommandPreview'

const SLASH_COMMANDS = [
  '/buy',
  '/sell',
  '/swap',
  '/analyze',
  '/positions',
  '/balance',
  '/risk',
  '/consult',
  '/debate',
  '/chart',
  '/master',
  '/pulse',
  '/summon',
]

/**
 * Renderer-only slash commands that are intercepted client-side and never
 * sent to the chat backend. Returns true when the command was handled here.
 */
function handleClientSideSlashCommand(input: string): boolean {
  const trimmed = input.trim().toLowerCase()
  if (trimmed === '/summon') {
    // Trigger the celebrate emotion via the renderer-internal event bus —
    // useCompanionState picks it up and crossfades the sprite for ~8 seconds.
    window.dispatchEvent(
      new CustomEvent('vibe-companion-emotion', {
        detail: { emotion: 'celebrate' },
      }),
    )
    return true
  }
  return false
}

interface InputBarProps {
  onSend: (content: string) => void
  onAbort: () => void
  isStreaming: boolean
  disabled: boolean
}

export interface InputBarHandle {
  prefillInput: (text: string) => void
}

export const InputBar = forwardRef<InputBarHandle, InputBarProps>(function InputBar(
  { onSend, onAbort, isStreaming, disabled },
  ref,
) {
  const [value, setValue] = useState('')
  const [pendingCommand, setPendingCommand] = useState<string | null>(null)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Expose prefillInput to parent
  useImperativeHandle(ref, () => ({
    prefillInput(text: string) {
      setValue(text)
      setTimeout(() => textareaRef.current?.focus(), 0)
    },
  }), [])

  // Compute filtered commands based on current input
  const filteredCommands = value.startsWith('/') && !value.includes(' ')
    ? SLASH_COMMANDS.filter(cmd => cmd.startsWith(value.toLowerCase()))
    : []

  // Show/hide autocomplete based on filtered results
  useEffect(() => {
    setShowAutocomplete(filteredCommands.length > 0 && value.length > 0)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clamp selected index when filtered list changes
  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1))
    }
  }, [filteredCommands.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [value])

  // Focus input when not streaming
  useEffect(() => {
    if (!isStreaming && !disabled) {
      textareaRef.current?.focus()
    }
  }, [isStreaming, disabled])

  const selectAutocomplete = useCallback((cmd: string) => {
    setValue(cmd + ' ')
    setShowAutocomplete(false)
    setSelectedIndex(0)
    textareaRef.current?.focus()
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled || isStreaming) return

    // Client-side commands (/summon) — handled locally, never sent to backend
    if (handleClientSideSlashCommand(trimmed)) {
      setValue('')
      return
    }

    // Trade commands get a preview step
    if (isTradeCommand(trimmed)) {
      setPendingCommand(trimmed)
      return
    }

    onSend(trimmed)
    setValue('')
  }, [value, disabled, isStreaming, onSend])

  const handleConfirmCommand = useCallback(() => {
    if (!pendingCommand) return
    onSend(pendingCommand)
    setValue('')
    setPendingCommand(null)
  }, [pendingCommand, onSend])

  const handleCancelCommand = useCallback(() => {
    setPendingCommand(null)
    // Keep input text so user can edit it
    textareaRef.current?.focus()
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Autocomplete navigation
      if (showAutocomplete && filteredCommands.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex(i => (i + 1) % filteredCommands.length)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length)
          return
        }
        if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
          e.preventDefault()
          selectAutocomplete(filteredCommands[selectedIndex])
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setShowAutocomplete(false)
          return
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        if (pendingCommand) {
          handleCancelCommand()
        } else if (isStreaming) {
          onAbort()
        }
      }
    },
    [handleSend, isStreaming, onAbort, pendingCommand, handleCancelCommand, showAutocomplete, filteredCommands, selectedIndex, selectAutocomplete],
  )

  return (
    <div className="chat-input-container">
      {pendingCommand && (
        <div className="chat-input-preview">
          <CommandPreview
            command={pendingCommand}
            onConfirm={handleConfirmCommand}
            onCancel={handleCancelCommand}
          />
        </div>
      )}
      <div style={{ position: 'relative' }}>
        {showAutocomplete && filteredCommands.length > 0 && (
          <div className="autocomplete-dropdown">
            {filteredCommands.map((cmd, i) => (
              <div
                key={cmd}
                className={`autocomplete-item${i === selectedIndex ? ' autocomplete-item--selected' : ''}`}
                onMouseDown={e => { e.preventDefault(); selectAutocomplete(cmd) }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {cmd}
              </div>
            ))}
          </div>
        )}
        <div className="chat-input-row">
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Connecting...' : isStreaming ? 'Streaming... (Esc to stop)' : 'Message Vibe Sensei...'}
            disabled={disabled}
            rows={1}
            aria-label="Chat message input"
          />
          {isStreaming ? (
            <button className="chat-send-btn" onClick={onAbort} aria-label="Stop streaming">
              STOP
            </button>
          ) : (
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={disabled || !value.trim()}
              aria-label="Send message"
            >
              SEND
            </button>
          )}
        </div>
      </div>
    </div>
  )
})
