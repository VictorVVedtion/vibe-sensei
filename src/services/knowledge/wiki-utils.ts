/**
 * Wiki Utilities — shared constants and helpers for the trading knowledge wiki.
 *
 * Centralizes wiki directory management, article I/O, and logging
 * used by compiler, auditor, query-router, ingest, and WikiTool.
 *
 * All writes are atomic (write .tmp, rename to final path).
 * File permissions are 0o600 for all wiki files.
 */

import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'fs'
import { dirname, join } from 'path'
import { homedir } from 'os'

// ── Constants ────────────────────────────────────────────────────────────────

export const WIKI_DIR = join(homedir(), '.vibe-sensei', 'wiki')
export const LOG_PATH = join(WIKI_DIR, 'log.md')

export const ALL_SUBDIRS = [
  'patterns',
  'patterns/discovered',
  'markets',
  'self',
  'sessions',
  'reports',
  'strategies',
  'lessons',
  'theses',
  'playbooks',
  'notes',
] as const

// ── Directory Bootstrap ──────────────────────────────────────────────────────

let dirsEnsured = false

/** Ensure wiki directory and all subdirectories exist. */
export function ensureWikiDirs(): void {
  if (dirsEnsured) return
  try {
    mkdirSync(WIKI_DIR, { recursive: true, mode: 0o700 })
    for (const sub of ALL_SUBDIRS) {
      mkdirSync(join(WIKI_DIR, sub), { recursive: true, mode: 0o700 })
    }
    dirsEnsured = true
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      dirsEnsured = true
      return
    }
    console.warn('[Wiki] failed to create wiki dirs:', err)
  }
}

// ── Path Safety ──────────────────────────────────────────────────────────────

/**
 * Validate that a relative article path is safe (no path traversal).
 * Rejects paths containing '..', absolute paths, and resolved paths
 * that escape WIKI_DIR.
 */
export function isSafeArticlePath(relativePath: string): boolean {
  if (relativePath.startsWith('/')) return false
  if (relativePath.includes('..')) return false
  const resolved = join(WIKI_DIR, relativePath)
  if (!resolved.startsWith(WIKI_DIR + '/') && resolved !== WIKI_DIR) return false
  return true
}

// ── Article I/O ──────────────────────────────────────────────────────────────

/** Write a wiki article atomically. Creates parent dirs as needed. */
export function writeArticleAtomic(relativePath: string, content: string): void {
  if (!isSafeArticlePath(relativePath)) {
    console.warn(`[Wiki] rejected unsafe article path: ${relativePath}`)
    return
  }
  ensureWikiDirs()
  const fullPath = join(WIKI_DIR, relativePath)
  const dir = dirname(fullPath)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const tmpPath = fullPath + '.tmp'
  writeFileSync(tmpPath, content, { encoding: 'utf-8', mode: 0o600 })
  renameSync(tmpPath, fullPath)
}

/** Read an existing wiki article, or return undefined if missing. */
export function readArticle(relativePath: string): string | undefined {
  try {
    return readFileSync(join(WIKI_DIR, relativePath), 'utf-8')
  } catch {
    return undefined
  }
}

// ── Article Discovery ────────────────────────────────────────────────────────

/** List all .md files in the wiki directory recursively. Returns absolute paths. */
export function listWikiArticles(): string[] {
  const result: string[] = []
  collectMarkdownFiles(WIKI_DIR, result)
  return result
}

/** Recursively collect .md files from a directory. */
function collectMarkdownFiles(dir: string, out: string[]): void {
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        collectMarkdownFiles(fullPath, out)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        out.push(fullPath)
      }
    }
  } catch {
    // Directory doesn't exist or is unreadable
  }
}

/** List wiki articles as relative paths. */
export function listWikiArticlesRelative(): string[] {
  return listWikiArticles().map(p => p.replace(WIKI_DIR + '/', ''))
}

// ── Content Helpers ──────────────────────────────────────────────────────────

/** Extract the first H1 title from markdown content. */
export function extractTitle(content: string): string {
  const match = content.match(/^# (.+)$/m)
  return match?.[1] ?? 'Untitled'
}

/** Strip YAML frontmatter from markdown content. */
export function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content
  const endIdx = content.indexOf('---', 3)
  if (endIdx === -1) return content
  return content.slice(endIdx + 3).trim()
}

/** Extract a date from YAML frontmatter. */
export function extractDate(content: string): string | null {
  const match = content.match(/^date:\s*(.+)$/m)
  return match?.[1]?.trim() ?? null
}

// ── Log ──────────────────────────────────────────────────────────────────────

/**
 * Append a single log entry to wiki/log.md.
 * Format: `[ISO timestamp] operation: details`
 * Append-only — a truncated last line is harmless.
 */
export function appendLog(entry: string): void {
  try {
    ensureWikiDirs()
    const ts = new Date().toISOString().slice(0, 19) + 'Z'
    const line = `[${ts}] ${entry}\n`
    appendFileSync(LOG_PATH, line, { encoding: 'utf-8', mode: 0o600 })
  } catch {
    // Logging is best-effort — never block wiki operations
  }
}
