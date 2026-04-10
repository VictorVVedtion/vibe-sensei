/**
 * ShortcutOverlay — semi-transparent overlay listing keyboard shortcuts.
 * Shown when Cmd/Ctrl is held for 500ms.
 */

interface ShortcutOverlayProps {
  isVisible: boolean
}

const SHORTCUTS: Array<{ key: string; label: string }> = [
  { key: 'Cmd+K', label: 'Command Palette' },
  { key: 'Cmd+/', label: 'Toggle Chat' },
  { key: 'Cmd+B', label: 'Buy' },
  { key: 'Cmd+S', label: 'Sell' },
  { key: 'Cmd+1/2/3', label: 'Focus Panel' },
  { key: 'Enter', label: 'Send' },
  { key: 'Esc', label: 'Cancel' },
]

export function ShortcutOverlay({ isVisible }: ShortcutOverlayProps) {
  if (!isVisible) return null

  return (
    <div className="shortcut-overlay">
      <div className="shortcut-card">
        {SHORTCUTS.map(s => (
          <div key={s.key} className="shortcut-row">
            <span className="shortcut-key">{s.key}</span>
            <span className="shortcut-label">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
