/**
 * ChartCapture — captures TradingView chart screenshots from the :3456 web server.
 *
 * The web frontend exposes a `/api/screenshot` endpoint that returns the
 * current chart as a PNG image. This module fetches that screenshot and
 * returns it as a base64 string for multimodal AI analysis.
 *
 * If the web server is not running or the screenshot endpoint is unavailable,
 * all methods fail gracefully (return null). The vision system treats chart
 * capture as optional — the entire feature silently degrades.
 */

// ── Constants ────────────────────────────────────────────────────────────

const DEFAULT_CHART_URL = 'http://localhost:3456'
const AVAILABILITY_TIMEOUT_MS = 2_000
const SCREENSHOT_TIMEOUT_MS = 5_000

// ── ChartCapture ─────────────────────────────────────────────────────────

export class ChartCapture {
  private readonly baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? DEFAULT_CHART_URL
  }

  /**
   * Check whether the TradingView web server is running and reachable.
   * Returns true if the root endpoint responds with HTTP 200 within the timeout.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, {
        signal: AbortSignal.timeout(AVAILABILITY_TIMEOUT_MS),
      })
      return res.ok
    } catch {
      return false
    }
  }

  /**
   * Capture the current chart as a base64-encoded PNG string.
   *
   * Fetches from the `/api/screenshot` endpoint on the web server.
   * Returns null if:
   *   - The web server is not running
   *   - The screenshot endpoint is not available (404)
   *   - The request times out
   *   - The response is empty or not an image
   */
  async capture(): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/screenshot`, {
        signal: AbortSignal.timeout(SCREENSHOT_TIMEOUT_MS),
      })

      if (!res.ok) {
        return null
      }

      // Verify we got an image response
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.startsWith('image/')) {
        return null
      }

      const buffer = await res.arrayBuffer()
      if (buffer.byteLength === 0) {
        return null
      }

      return Buffer.from(buffer).toString('base64')
    } catch {
      return null
    }
  }

  /**
   * Capture chart from a file path instead of the web server.
   * Used as a fallback when a user provides a chart image manually.
   *
   * @param filePath - Absolute path to a PNG/JPEG chart image
   * @returns base64-encoded image data, or null on failure
   */
  async captureFromFile(filePath: string): Promise<string | null> {
    try {
      const { readFile } = await import('fs/promises')
      const buffer = await readFile(filePath)
      if (buffer.byteLength === 0) {
        return null
      }
      return buffer.toString('base64')
    } catch {
      return null
    }
  }

  /**
   * Determine the MIME type from a file path extension.
   * Returns 'image/png' as default for unknown extensions.
   */
  static mimeTypeFromPath(filePath: string): string {
    const lower = filePath.toLowerCase()
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      return 'image/jpeg'
    }
    if (lower.endsWith('.webp')) {
      return 'image/webp'
    }
    return 'image/png'
  }
}
