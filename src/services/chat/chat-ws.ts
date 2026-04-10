/**
 * Chat WebSocket Handler — manages per-connection ChatSession lifecycle.
 * Connected via the /ws/chat path from the UDF server's upgrade router.
 *
 * Protocol:
 *   Client → Server: { type: "message", content: "buy 0.1 BTC" }
 *   Client → Server: { type: "abort" }
 *   Server → Client: { type: "chunk", content: "..." }
 *   Server → Client: { type: "tool_use", id, name, input }
 *   Server → Client: { type: "tool_result", name, data }
 *   Server → Client: { type: "guardian", alert: "..." }
 *   Server → Client: { type: "thinking", content: "..." }
 *   Server → Client: { type: "done", usage? }
 *   Server → Client: { type: "error", message: "..." }
 *   Server → Client: { type: "connected", sessionId }
 */

import type { WebSocket } from 'ws'
import { ChatSession, type ChatRequest } from './chat-query.js'

/**
 * Handle a new WebSocket connection on /ws/chat.
 * Creates a ChatSession and wires up message handling.
 */
export function handleChatConnection(ws: WebSocket): void {
  const session = new ChatSession()
  let streaming = false

  console.log(`[WS:chat] client connected (session=${session.id})`)

  // Send connection acknowledgment
  safeSend(ws, { type: 'connected', sessionId: session.id })

  ws.on('message', (raw: Buffer | string) => {
    let msg: ChatRequest
    try {
      const text = typeof raw === 'string' ? raw : raw.toString('utf-8')
      msg = JSON.parse(text)
    } catch {
      safeSend(ws, { type: 'error', message: 'Invalid JSON' })
      return
    }

    if (msg.type === 'abort') {
      session.abort()
      return
    }

    if (msg.type === 'message') {
      if (!msg.content || typeof msg.content !== 'string') {
        safeSend(ws, { type: 'error', message: 'Empty message' })
        return
      }

      if (streaming) {
        safeSend(ws, {
          type: 'error',
          message: 'Already streaming — send abort first',
        })
        return
      }

      // Stream response
      streaming = true
      streamResponse(ws, session, msg.content).finally(() => {
        streaming = false
      })
      return
    }

    safeSend(ws, { type: 'error', message: `Unknown message type: ${(msg as any).type}` })
  })

  ws.on('close', () => {
    console.log(`[WS:chat] client disconnected (session=${session.id})`)
    session.abort()
  })

  ws.on('error', (err: Error) => {
    console.error(`[WS:chat] error (session=${session.id}): ${err.message}`)
    session.abort()
  })
}

/**
 * Run the chat session's send() generator and pipe frames to WebSocket.
 */
async function streamResponse(
  ws: WebSocket,
  session: ChatSession,
  userText: string,
): Promise<void> {
  try {
    for await (const frame of session.send(userText)) {
      if (ws.readyState !== 1 /* OPEN */) {
        session.abort()
        break
      }
      safeSend(ws, frame)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    safeSend(ws, { type: 'error', message: msg })
  }
}

/**
 * Send a JSON message to a WebSocket client. Swallows errors.
 */
function safeSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState !== 1 /* OPEN */) return
  try {
    ws.send(JSON.stringify(data))
  } catch {
    // WebSocket send failures are non-fatal
  }
}
