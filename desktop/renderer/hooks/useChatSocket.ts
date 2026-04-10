/**
 * useChatSocket — WebSocket hook for the AI chat panel.
 * Connects to ws://localhost:{port}/ws/chat, manages message state,
 * handles streaming, reconnection, and abort.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { GuardianAlert } from '../../shared/ipc-channels'

// ── Types ──────────────────────────────────────────────────────────────────

export type ChatRole = 'user' | 'assistant' | 'system'

export interface GuardianMeta {
  masterName?: string
  masterInitials?: string
  rarity?: string
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: number
  toolUse?: { name: string; input: unknown }
  isStreaming?: boolean
  isError?: boolean
  guardianMeta?: GuardianMeta
  guardianAlert?: GuardianAlert
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

const STORAGE_KEY = 'vibesensei_chat_messages'
const SAVE_DEBOUNCE_MS = 2000

interface UseChatSocketReturn {
  messages: ChatMessage[]
  status: ConnectionStatus
  sessionId: string | null
  sendMessage: (content: string) => void
  abort: () => void
  clearMessages: () => void
  dismissMessage: (id: string) => void
  resetSession: () => void
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useChatSocket(port: number | null): UseChatSocketReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [sessionId, setSessionId] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempt = useRef(0)
  const streamingMsgId = useRef<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restoredFromStorage = useRef(false)

  // Debounced save to localStorage
  const debounceSave = useCallback((msgs: ChatMessage[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try {
        // Strip streaming flags before persisting
        const toSave = msgs
          .filter(m => !m.isStreaming)
          .map(({ isStreaming: _, ...rest }) => rest)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
      } catch {
        // localStorage full or unavailable — ignore
      }
    }, SAVE_DEBOUNCE_MS)
  }, [])

  // Restore messages from localStorage on mount (before WS connects)
  useEffect(() => {
    if (restoredFromStorage.current) return
    restoredFromStorage.current = true
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed: ChatMessage[] = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
        }
      }
    } catch {
      // Corrupted data — start fresh
    }
  }, [])

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!port) return

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setStatus('connecting')
    const ws = new WebSocket(`ws://localhost:${port}/ws/chat`)
    wsRef.current = ws

    ws.onopen = () => {
      reconnectAttempt.current = 0
      // Status will be set to 'connected' when we receive the 'connected' frame
    }

    ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data)
        handleFrame(frame)
      } catch {
        // Ignore malformed frames
      }
    }

    ws.onclose = () => {
      wsRef.current = null
      streamingMsgId.current = null
      setStatus('disconnected')
      scheduleReconnect()
    }

    ws.onerror = () => {
      // onclose will fire after this
    }
  }, [port])

  // Reconnect with exponential backoff (1s, 3s, 10s, max 10s)
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimer.current) return
    const delays = [1000, 3000, 10000]
    const delay = delays[Math.min(reconnectAttempt.current, delays.length - 1)]!
    reconnectAttempt.current++

    setStatus('reconnecting')
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null
      connect()
    }, delay)
  }, [connect])

  // Handle incoming frames from server
  const handleFrame = useCallback((frame: any) => {
    switch (frame.type) {
      case 'connected':
        setSessionId(frame.sessionId ?? null)
        setStatus('connected')
        break

      case 'chunk': {
        const msgId = streamingMsgId.current
        if (!msgId) break
        setMessages(prev => prev.map(m =>
          m.id === msgId
            ? { ...m, content: m.content + (frame.content ?? '') }
            : m
        ))
        break
      }

      case 'thinking':
        // Ignore thinking for now — could add a thinking indicator later
        break

      case 'tool_use':
        setMessages(prev => [
          ...prev,
          {
            id: `tool-${frame.id}`,
            role: 'system',
            content: `Using tool: ${frame.name}`,
            timestamp: Date.now(),
            toolUse: { name: frame.name, input: frame.input },
          },
        ])
        break

      case 'guardian': {
        const alert: GuardianAlert = {
          id: frame.alert?.id ?? `guardian-${Date.now()}`,
          severity: frame.alert?.severity ?? 'warning',
          masterName: frame.alert?.masterName ?? 'Guardian',
          message: frame.alert?.message ?? frame.alert ?? 'Guardian alert',
          checkName: frame.alert?.checkName,
          timestamp: Date.now(),
        }
        setMessages(prev => [
          ...prev,
          {
            id: `guardian-${Date.now()}`,
            role: 'system',
            content: alert.message,
            timestamp: Date.now(),
            guardianAlert: alert,
          },
        ])
        break
      }

      case 'done':
        if (streamingMsgId.current) {
          setMessages(prev => prev.map(m =>
            m.id === streamingMsgId.current
              ? { ...m, isStreaming: false }
              : m
          ))
          streamingMsgId.current = null
        }
        break

      case 'error':
        if (streamingMsgId.current) {
          setMessages(prev => prev.map(m =>
            m.id === streamingMsgId.current
              ? { ...m, isStreaming: false, isError: true, content: m.content || frame.message }
              : m
          ))
          streamingMsgId.current = null
        } else {
          setMessages(prev => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: 'system',
              content: frame.message ?? 'Unknown error',
              timestamp: Date.now(),
              isError: true,
            },
          ])
        }
        break
    }
  }, [])

  // Send user message
  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    if (!content.trim()) return

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    }

    // Create empty assistant message for streaming
    const assistantId = `assistant-${Date.now()}`
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }

    streamingMsgId.current = assistantId
    setMessages(prev => [...prev, userMsg, assistantMsg])

    wsRef.current.send(JSON.stringify({ type: 'message', content: content.trim() }))
  }, [])

  // Abort current stream
  const abort = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'abort' }))
    }
  }, [])

  // Clear chat history
  const clearMessages = useCallback(() => {
    setMessages([])
    streamingMsgId.current = null
  }, [])

  // Dismiss a specific message (used by guardian action cards)
  const dismissMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id))
  }, [])

  // Reset session: clear localStorage + messages + notify backend
  const resetSession = useCallback(() => {
    setMessages([])
    streamingMsgId.current = null
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'abort' }))
    }
  }, [])

  // Persist messages to localStorage on every change (debounced)
  useEffect(() => {
    debounceSave(messages)
  }, [messages, debounceSave])

  // Clean up save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  // Connect on mount / port change
  useEffect(() => {
    if (!port) return
    connect()

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [port, connect])

  return { messages, status, sessionId, sendMessage, abort, clearMessages, dismissMessage, resetSession }
}
