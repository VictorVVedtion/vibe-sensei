import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'

// ── localStorage persistence ─────────────────────────────────────────────

const STORAGE_KEY = 'vibesensei_sidebar_collapsed'

function loadCollapsedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return new Set(arr)
    return new Set()
  } catch {
    return new Set()
  }
}

function persistCollapsedIds(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // Storage full or unavailable — silently discard
  }
}

// ── Props ────────────────────────────────────────────────────────────────

interface CollapsibleCardProps {
  /** Unique identifier for persistence */
  id: string
  /** Display title in the header bar */
  title: string
  /** Whether the card starts expanded (before localStorage override) */
  defaultExpanded?: boolean
  /** Visual tier (1-4), affects rendering priority */
  tier?: 1 | 2 | 3 | 4
  /** Optional badge displayed right-aligned in the header (e.g. count) */
  badge?: ReactNode
  /** Callback when toggled */
  onToggle?: (expanded: boolean) => void
  /** Card contents */
  children: ReactNode
}

// ── Component ────────────────────────────────────────────────────────────

export function CollapsibleCard({
  id,
  title,
  defaultExpanded = true,
  tier = 2,
  badge,
  onToggle,
  children,
}: CollapsibleCardProps) {
  // Resolve initial state: localStorage wins over defaultExpanded
  const [expanded, setExpanded] = useState(() => {
    const collapsed = loadCollapsedIds()
    if (collapsed.has(id)) return false
    return defaultExpanded
  })

  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    undefined,
  )

  // Measure content height for smooth animation
  useEffect(() => {
    if (!contentRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContentHeight(entry.contentRect.height)
      }
    })
    observer.observe(contentRef.current)
    return () => observer.disconnect()
  }, [])

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev
      // Persist to localStorage
      const ids = loadCollapsedIds()
      if (next) {
        ids.delete(id)
      } else {
        ids.add(id)
      }
      persistCollapsedIds(ids)
      onToggle?.(next)
      return next
    })
  }, [id, onToggle])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggle()
      }
    },
    [toggle],
  )

  const chevron = expanded ? '\u25BE' : '\u25B8' // ▾ / ▸
  const maxHeight = expanded
    ? contentHeight !== undefined
      ? contentHeight
      : 9999
    : 0

  return (
    <div style={styles.card} data-tier={tier}>
      {/* Header — clickable toggle */}
      <div
        style={styles.header}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={`collapsible-${id}`}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
      >
        <span style={styles.chevron}>{chevron}</span>
        <span style={styles.title}>{title}</span>
        {badge != null && (
          <>
            <span style={styles.spacer} />
            {badge}
          </>
        )}
      </div>

      {/* Animated content area */}
      <div
        id={`collapsible-${id}`}
        style={{
          ...styles.contentWrapper,
          maxHeight,
          opacity: expanded ? 1 : 0,
        }}
      >
        <div ref={contentRef}>{children}</div>
      </div>
    </div>
  )
}

// ── Programmatic collapse for space-constrained mode ─────────────────────

/**
 * Force-collapse a card by ID. Used by the sidebar's ResizeObserver
 * when height drops below the minimum threshold.
 */
export function forceCollapseById(id: string): void {
  const ids = loadCollapsedIds()
  ids.add(id)
  persistCollapsedIds(ids)
}

/**
 * Check if a card is persisted as collapsed.
 */
export function isPersistedCollapsed(id: string): boolean {
  return loadCollapsedIds().has(id)
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#000000',
    borderRadius: 0,
    border: '1px solid rgba(156, 255, 147, 0.3)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    minHeight: 28,
    background: 'rgba(156, 255, 147, 0.08)',
    borderBottom: '1px solid rgba(156, 255, 147, 0.2)',
    cursor: 'pointer',
    userSelect: 'none' as const,
    transition: 'background var(--transition-fast)',
  },
  chevron: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: 'var(--primary)',
    flexShrink: 0,
    width: 10,
    textAlign: 'center' as const,
    opacity: 0.6,
  },
  title: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--primary)',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  spacer: {
    flex: 1,
  },
  contentWrapper: {
    overflow: 'hidden' as const,
    transition: 'max-height 200ms ease, opacity 150ms ease',
  },
}
