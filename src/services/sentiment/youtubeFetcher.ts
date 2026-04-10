/**
 * YouTube transcripts fetcher for /pulse.
 *
 * Shells out to `yt-dlp` to (a) search YouTube for ticker-related videos in
 * the lookback window and (b) pull captions/transcripts for the top results.
 * Strictly optional: when yt-dlp is missing, returns an empty SourceResult
 * with an `error` describing the missing binary — never throws.
 *
 * Hard caps:
 *   - max 5 videos
 *   - 30s overall timeout (the slowest fetcher in the brief)
 *   - transcript text only (no audio download, no video download)
 */

import { spawn } from 'node:child_process'
import type { SentimentSnippet, SourceResult } from './types.js'

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_VIDEOS = 5

interface YtDlpVideo {
  id?: string
  title?: string
  webpage_url?: string
  duration?: number
  view_count?: number
  upload_date?: string
  description?: string
}

export interface YtDlpRunner {
  /**
   * Run yt-dlp with the given args. Resolves with stdout text on success or
   * rejects with an Error. Implementations should respect the timeout.
   */
  run(args: string[], timeoutMs: number): Promise<string>
  /** True when the yt-dlp binary is available on PATH. */
  isAvailable(): Promise<boolean>
}

/** Default runner: shells out via node:child_process. */
export const defaultYtDlpRunner: YtDlpRunner = {
  async isAvailable(): Promise<boolean> {
    return new Promise(resolve => {
      try {
        const proc = spawn('yt-dlp', ['--version'], { stdio: 'ignore' })
        proc.on('error', () => resolve(false))
        proc.on('exit', code => resolve(code === 0))
      } catch {
        resolve(false)
      }
    })
  },

  run(args: string[], timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let stdout = ''
      let stderr = ''
      let settled = false
      const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] })

      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        // Best-effort kill: if the process already exited between the timer
        // firing and this line, kill() throws ESRCH which we intentionally
        // swallow — there's nothing left to clean up.
        try { proc.kill('SIGKILL') } catch { /* already exited */ }
        reject(new Error('yt-dlp timeout'))
      }, timeoutMs)

      proc.stdout.on('data', d => { stdout += d.toString() })
      proc.stderr.on('data', d => { stderr += d.toString() })
      proc.on('error', err => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(err)
      })
      proc.on('exit', code => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (code === 0) resolve(stdout)
        else reject(new Error(`yt-dlp exit ${code}: ${stderr.slice(0, 200)}`))
      })
    })
  },
}

/**
 * Search YouTube via yt-dlp's `ytsearchN:` query syntax.
 * Returns parsed JSON metadata for up to MAX_VIDEOS results.
 */
async function searchVideos(
  symbol: string,
  runner: YtDlpRunner,
  timeoutMs: number,
): Promise<YtDlpVideo[]> {
  const base = symbol.split('/')[0] ?? symbol
  const query = `ytsearch${MAX_VIDEOS}:${base} trading analysis`
  const args = [
    '--dump-json',
    '--no-warnings',
    '--skip-download',
    '--no-playlist',
    '--default-search', 'ytsearch',
    query,
  ]
  const stdout = await runner.run(args, timeoutMs)
  const lines = stdout.split('\n').filter(l => l.trim().length > 0)
  const videos: YtDlpVideo[] = []
  for (const line of lines) {
    try {
      videos.push(JSON.parse(line) as YtDlpVideo)
    } catch {
      // Skip non-JSON lines
    }
  }
  return videos
}

/**
 * Map a yt-dlp video metadata blob into a SentimentSnippet.
 * The "snippet" body is the description (yt-dlp captions are off the hot
 * path because per-video caption fetches add 5-15s each — v1 uses descriptions
 * only, which is enough to surface the topic without blowing the latency budget).
 */
function videoToSnippet(video: YtDlpVideo): SentimentSnippet | null {
  if (!video.title || !video.webpage_url) return null
  return {
    source: 'youtube',
    title: video.title,
    url: video.webpage_url,
    score: video.view_count ?? 0,
    ts: parseUploadDate(video.upload_date),
    snippet: (video.description ?? '').slice(0, 280),
    engagement: video.duration,
  }
}

function parseUploadDate(yyyymmdd?: string): number {
  if (!yyyymmdd || yyyymmdd.length !== 8) return 0
  const year = Number(yyyymmdd.slice(0, 4))
  const month = Number(yyyymmdd.slice(4, 6))
  const day = Number(yyyymmdd.slice(6, 8))
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return 0
  return Date.UTC(year, month - 1, day)
}

/**
 * Fetch YouTube videos for a symbol via yt-dlp. Always resolves; never throws.
 * If yt-dlp is missing, returns an empty SourceResult with an instructive error.
 */
export async function fetchYouTube(
  symbol: string,
  opts: {
    timeoutMs?: number
    runner?: YtDlpRunner
  } = {},
): Promise<SourceResult> {
  const runner = opts.runner ?? defaultYtDlpRunner
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const fetchedAt = Date.now()

  const available = await runner.isAvailable()
  if (!available) {
    return {
      source: 'youtube',
      snippets: [],
      aggregateSignal: 0,
      fetchedAt,
      error: 'yt-dlp not installed (run: brew install yt-dlp)',
    }
  }

  try {
    const videos = await searchVideos(symbol, runner, timeoutMs)
    const snippets = videos
      .map(videoToSnippet)
      .filter((s): s is SentimentSnippet => s !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_VIDEOS)

    // Saturating signal — videos that exist on the topic indicate buzz, not polarity
    const totalViews = snippets.reduce((acc, s) => acc + Math.max(0, s.score), 0)
    const aggregateSignal = Math.tanh(totalViews / 500_000)

    return {
      source: 'youtube',
      snippets,
      aggregateSignal,
      fetchedAt,
    }
  } catch (err) {
    return {
      source: 'youtube',
      snippets: [],
      aggregateSignal: 0,
      fetchedAt,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
