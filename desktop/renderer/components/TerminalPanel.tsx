import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

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
        background: '#0a0a0a',
        foreground: '#e0e0e0',
        cursor: '#00d4aa',
        cursorAccent: '#0a0a0a',
        selectionBackground: '#1a3a2a',
        selectionForeground: '#ffffff',
        black: '#0a0a0a',
        red: '#ff5555',
        green: '#00d4aa',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#e0e0e0',
        brightBlack: '#4a4a4a',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff',
      },
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminal.open(container)
    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Connect PTY data -> terminal display
    window.electronAPI.onPtyData((data: string) => {
      terminal.write(data)
    })

    // Connect terminal input -> PTY stdin
    terminal.onData((data: string) => {
      window.electronAPI.sendPtyInput(data)
    })

    // Handle resize via ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitAddon.fit()
        const { cols, rows } = terminal
        window.electronAPI.sendPtyResize(cols, rows)
      })
    })
    resizeObserver.observe(container)

    // Initial resize notification
    const { cols, rows } = terminal
    window.electronAPI.sendPtyResize(cols, rows)

    return () => {
      resizeObserver.disconnect()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        padding: 4,
      }}
    />
  )
}
