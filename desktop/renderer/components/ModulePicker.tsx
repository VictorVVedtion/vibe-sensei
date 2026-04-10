import { useState, useRef, useEffect, useCallback } from 'react'

// ── Module registry ─────────────────────────────────────────────────────

export type SidebarModuleId =
  | 'MasterCard'
  | 'RiskMap'
  | 'Positions'
  | 'AlertFeed'
  | 'Balance'
  | 'TradeHistory'
  | 'WeeklyReview'
  | 'AntiPortfolio'
  | 'ArbitrageCard'

const ALL_MODULES: { id: SidebarModuleId; label: string }[] = [
  { id: 'MasterCard', label: 'Master Card' },
  { id: 'RiskMap', label: 'Risk Map' },
  { id: 'Positions', label: 'Positions' },
  { id: 'AlertFeed', label: 'Alert Feed' },
  { id: 'Balance', label: 'Balance' },
  { id: 'TradeHistory', label: 'Trade History' },
  { id: 'WeeklyReview', label: 'Weekly Review' },
  { id: 'AntiPortfolio', label: 'Anti-Portfolio' },
  { id: 'ArbitrageCard', label: 'Arbitrage Card' },
]

const STORAGE_KEY = 'vibesensei_sidebar_modules'

// ── Persistence ─────────────────────────────────────────────────────────

export function loadEnabledModules(): Set<SidebarModuleId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set(ALL_MODULES.map((m) => m.id))
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return new Set(arr as SidebarModuleId[])
    return new Set(ALL_MODULES.map((m) => m.id))
  } catch {
    return new Set(ALL_MODULES.map((m) => m.id))
  }
}

function persistEnabledModules(ids: Set<SidebarModuleId>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // Storage unavailable
  }
}

// ── Component ───────────────────────────────────────────────────────────

interface ModulePickerProps {
  enabledModules: Set<SidebarModuleId>
  onModulesChange: (modules: Set<SidebarModuleId>) => void
}

export function ModulePicker({
  enabledModules,
  onModulesChange,
}: ModulePickerProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Position the overlay above the button
  const [position, setPosition] = useState<{ bottom: number; left: number }>({
    bottom: 0,
    left: 0,
  })

  const openPicker = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPosition({
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
      })
    }
    setOpen(true)
  }, [])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        overlayRef.current &&
        !overlayRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    // Delay to avoid the opening click from closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  const toggleModule = useCallback(
    (id: SidebarModuleId) => {
      const next = new Set(enabledModules)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      persistEnabledModules(next)
      onModulesChange(next)
    },
    [enabledModules, onModulesChange],
  )

  return (
    <>
      <button
        ref={btnRef}
        className="module-picker-btn"
        onClick={open ? () => setOpen(false) : openPicker}
        aria-label="Add or remove sidebar modules"
        aria-expanded={open}
      >
        + ADD MODULE
      </button>

      {open && (
        <div
          ref={overlayRef}
          className="module-picker-overlay"
          style={{
            position: 'fixed',
            bottom: position.bottom,
            left: position.left,
            minWidth: btnRef.current
              ? btnRef.current.getBoundingClientRect().width
              : 200,
          }}
        >
          {ALL_MODULES.map((mod) => {
            const active = enabledModules.has(mod.id)
            return (
              <div
                key={mod.id}
                className="module-picker-item"
                onClick={() => toggleModule(mod.id)}
                role="switch"
                aria-checked={active}
                aria-label={`${mod.label} module`}
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleModule(mod.id) } }}
              >
                <label>{mod.label}</label>
                <div
                  className={`module-picker-toggle${active ? ' active' : ''}`}
                />
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
