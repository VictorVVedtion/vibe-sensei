import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

type OverlayState =
  | { kind: 'none' }
  | { kind: 'disconnected'; exitCode: number }
  | { kind: 'reconnecting'; exitCode: number; attempt: number }
  | { kind: 'failed'; exitCode: number }

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [overlay, setOverlay] = useState<OverlayState>({ kind: 'none' })

  const handleReconnect = useCallback(() => {
    setOverlay({ kind: 'reconnecting', exitCode: 0, attempt: 1 })
    ;(window as any).electronAPI.restartPty()
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily:
        "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      lineHeight: 1.2,
      theme: {
        background: '#0A1628',
        foreground: '#E2E4ED',
        cursor: '#00D4FF',
        cursorAccent: '#0A1628',
        selectionBackground: '#253550',
        selectionForeground: '#ffffff',
        black: '#0A1628',
        red: '#FF4D6A',
        green: '#00E5A0',
        yellow: '#FFBB33',
        blue: '#6B4CF0',
        magenta: '#ff79c6',
        cyan: '#00D4FF',
        white: '#E2E4ED',
        brightBlack: '#7B8AA0',
        brightRed: '#FF4D6A',
        brightGreen: '#00E5A0',
        brightYellow: '#FFBB33',
        brightBlue: '#6B4CF0',
        brightMagenta: '#ff92df',
        brightCyan: '#00D4FF',
        brightWhite: '#ffffff',
      },
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminal.open(container)
    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const api = (window as any).electronAPI

    // Connect PTY data -> terminal display
    api.onPtyData((data: string) => {
      terminal.write(data)
    })

    // Connect terminal input -> PTY stdin
    terminal.onData((data: string) => {
      api.sendPtyInput(data)
    })

    // PTY exit -> show disconnected overlay
    const cleanupExit = api.onPtyExit((exitCode: number) => {
      setOverlay({ kind: 'disconnected', exitCode })
    })

    // PTY restarting -> show reconnecting overlay with attempt count
    const cleanupRestarting = api.onPtyRestarting(
      (info: { attempt: number; delayMs: number }) => {
        setOverlay((prev: OverlayState) => {
          const exitCode = 'exitCode' in prev ? prev.exitCode : 0
          if (info.attempt >= 5) {
            return { kind: 'failed', exitCode }
          }
          return { kind: 'reconnecting', exitCode, attempt: info.attempt }
        })
      },
    )

    // PTY ready -> clear overlay, re-focus terminal
    const cleanupReady = api.onPtyReady(() => {
      setOverlay({ kind: 'none' })
      terminal.clear()
      terminal.focus()
      const { cols, rows } = terminal
      api.sendPtyResize(cols, rows)
    })

    // Handle resize via ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitAddon.fit()
        const { cols, rows } = terminal
        api.sendPtyResize(cols, rows)
      })
    })
    resizeObserver.observe(container)

    // Initial resize notification
    const { cols, rows } = terminal
    api.sendPtyResize(cols, rows)

    return () => {
      resizeObserver.disconnect()
      cleanupExit?.()
      cleanupRestarting?.()
      cleanupReady?.()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [])

  return (
    <div style={{ position: 'relative', flex: 1, width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          padding: 4,
          opacity: overlay.kind !== 'none' ? 0.3 : 1,
          transition: 'opacity 200ms ease',
        }}
      />
      {overlay.kind !== 'none' && (
        <TerminalOverlay overlay={overlay} onReconnect={handleReconnect} />
      )}
    </div>
  )
}

function TerminalOverlay({
  overlay,
  onReconnect,
}: {
  overlay: Exclude<OverlayState, { kind: 'none' }>
  onReconnect: () => void
}) {
  return (
    <div style={overlayContainerStyle}>
      <div style={overlayCardStyle}>
        {overlay.kind === 'disconnected' && (
          <>
            <div style={{ color: '#FF4D6A', fontSize: 14, fontWeight: 600 }}>
              Terminal disconnected (exit code {overlay.exitCode})
            </div>
            <div style={{ color: '#7B8AA0', fontSize: 12 }}>
              Attempting to reconnect...
            </div>
          </>
        )}

        {overlay.kind === 'reconnecting' && (
          <>
            <div style={{ color: '#FFBB33', fontSize: 14, fontWeight: 600 }}>
              Reconnecting...
            </div>
            <div style={{ color: '#7B8AA0', fontSize: 12 }}>
              Attempt {overlay.attempt} of 5
            </div>
            <Spinner />
          </>
        )}

        {overlay.kind === 'failed' && (
          <>
            <div style={{ color: '#FF4D6A', fontSize: 14, fontWeight: 600 }}>
              Terminal disconnected (exit code {overlay.exitCode})
            </div>
            <div style={{ color: '#7B8AA0', fontSize: 12 }}>
              Auto-restart exhausted after 5 attempts
            </div>
            <button onClick={onReconnect} style={reconnectButtonStyle}>
              Reconnect
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div
      style={{
        width: 20,
        height: 20,
        border: '2px solid #253550',
        borderTopColor: '#00D4FF',
        borderRadius: '50%',
        animation: 'pty-spinner 0.8s linear infinite',
      }}
    />
  )
}

const overlayContainerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10,
  pointerEvents: 'auto',
}

const overlayCardStyle: React.CSSProperties = {
  background: 'rgba(10, 22, 40, 0.85)',
  border: '1px solid #253550',
  borderRadius: 8,
  padding: '24px 32px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  maxWidth: 360,
}

const reconnectButtonStyle: React.CSSProperties = {
  background: '#00D4FF',
  color: '#0A1628',
  border: 'none',
  borderRadius: 4,
  padding: '8px 20px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: 4,
}
