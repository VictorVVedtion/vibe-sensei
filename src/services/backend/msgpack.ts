/**
 * MessagePack serialization helpers with length-prefixed framing.
 *
 * Wire format: [u32 big-endian length][msgpack payload]
 *
 * The 4-byte length prefix allows the receiver to know exactly how many bytes
 * to read before deserializing, enabling reliable streaming over UDS.
 */

import { encode, decode } from '@msgpack/msgpack'

// ─── Frame Constants ───────────────────────────────────────────────────────

/** Length prefix size in bytes (u32 big-endian). */
export const FRAME_HEADER_SIZE = 4

/** Maximum payload size: 16 MB. Prevents accidental memory exhaustion. */
export const MAX_PAYLOAD_SIZE = 16 * 1024 * 1024

// ─── Serialization ─────────────────────────────────────────────────────────

/**
 * Serialize a value to a length-prefixed msgpack frame.
 * Returns a Buffer containing [u32-BE length][msgpack bytes].
 */
export function serializeFrame(value: unknown): Buffer {
  const payload = encode(value)
  const frame = Buffer.allocUnsafe(FRAME_HEADER_SIZE + payload.byteLength)
  frame.writeUInt32BE(payload.byteLength, 0)
  Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength).copy(
    frame,
    FRAME_HEADER_SIZE,
  )
  return frame
}

/**
 * Deserialize a msgpack payload (without the length prefix).
 * The caller is responsible for stripping the 4-byte header first.
 */
export function deserializePayload<T = unknown>(payload: Uint8Array): T {
  return decode(payload) as T
}

// ─── Frame Decoder (streaming) ─────────────────────────────────────────────

/**
 * Incremental frame decoder for streaming socket data.
 *
 * Buffers incoming chunks and yields complete deserialized messages
 * as they become available. Handles partial reads gracefully.
 *
 * Usage:
 *   const decoder = new FrameDecoder()
 *   socket.on('data', (chunk) => {
 *     for (const msg of decoder.feed(chunk)) {
 *       handleMessage(msg)
 *     }
 *   })
 */
export class FrameDecoder {
  private buffer: Buffer = Buffer.alloc(0)

  /**
   * Feed raw bytes into the decoder.
   * Returns an array of fully decoded messages (may be empty).
   */
  feed<T = unknown>(chunk: Buffer | Uint8Array): T[] {
    this.buffer = Buffer.concat([this.buffer, chunk])
    const messages: T[] = []

    while (this.buffer.length >= FRAME_HEADER_SIZE) {
      const payloadLen = this.buffer.readUInt32BE(0)

      if (payloadLen > MAX_PAYLOAD_SIZE) {
        // Corrupt or malicious frame — reset buffer to prevent infinite loop
        this.buffer = Buffer.alloc(0)
        throw new Error(
          `Frame payload too large: ${payloadLen} bytes (max ${MAX_PAYLOAD_SIZE})`,
        )
      }

      const totalLen = FRAME_HEADER_SIZE + payloadLen
      if (this.buffer.length < totalLen) {
        // Not enough data yet — wait for more
        break
      }

      const payload = this.buffer.subarray(FRAME_HEADER_SIZE, totalLen)
      messages.push(deserializePayload<T>(payload))
      this.buffer = this.buffer.subarray(totalLen)
    }

    return messages
  }

  /** Reset internal buffer (e.g., on reconnect). */
  reset(): void {
    this.buffer = Buffer.alloc(0)
  }
}
