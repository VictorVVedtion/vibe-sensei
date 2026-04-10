import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { TitleBar } from './TitleBar'
import { StatusBar } from './StatusBar'
import '../styles/layout.css'
import '../styles/theme.css'

interface LayoutProps {
  watchlist: ReactNode
  chat: ReactNode
  chart: ReactNode
  sidebar: ReactNode
  liveFeed: ReactNode
}

type FocusedPanel = 'chat' | 'chart' | 'sidebar'

const MIN_TERMINAL_WIDTH = 300
const MIN_RIGHT_WIDTH = 400
const MIN_SIDEBAR_HEIGHT = 200
const MIN_CHART_HEIGHT = 200

export function Layout({
  watchlist,
  chat,
  chart,
  sidebar,
  liveFeed,
}: LayoutProps) {
  // Panel sizing state (percentages of available space)
  // Left column (chart + chat) width as % of non-feed space
  const [terminalWidthPct, setTerminalWidthPct] = useState(78)
  // Chart height as % of left column (golden: 60% chart, 40% chat)
  const [chartHeightPct, setChartHeightPct] = useState(60)
  const [focusedPanel, setFocusedPanel] = useState<FocusedPanel>('chat')

  // Read persisted panel sizes from electron-store on mount
  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api || typeof api.getLayoutState !== 'function') return

    api.getLayoutState().then((state: { terminalWidthPercent?: number; chartHeightPercent?: number } | null) => {
      if (!state) return
      if (typeof state.terminalWidthPercent === 'number' && state.terminalWidthPercent > 0) {
        setTerminalWidthPct(state.terminalWidthPercent)
      }
      if (typeof state.chartHeightPercent === 'number' && state.chartHeightPercent > 0) {
        setChartHeightPct(state.chartHeightPercent)
      }
    }).catch(() => {
      // Persistence unavailable — use defaults
    })
  }, [])

  // Dragging state
  const [draggingH, setDraggingH] = useState(false)
  const [draggingV, setDraggingV] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  // Refs for chat panel focus
  const chatPanelRef = useRef<HTMLDivElement>(null)

  // Keyboard shortcuts: Cmd/Ctrl + 1/2/3
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      if (e.key === '1') {
        e.preventDefault()
        setFocusedPanel('chat')
        // Focus chat input
        const chatInput = chatPanelRef.current?.querySelector(
          '.chat-input',
        ) as HTMLTextAreaElement | null
        chatInput?.focus()
      } else if (e.key === '2') {
        e.preventDefault()
        setFocusedPanel('chart')
      } else if (e.key === '3') {
        e.preventDefault()
        setFocusedPanel('sidebar')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Horizontal divider drag (terminal width)
  const onHDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setDraggingH(true)

      const startX = e.clientX
      const startPct = terminalWidthPct
      const grid = gridRef.current
      if (!grid) return
      const gridWidth = grid.clientWidth

      function onMouseMove(ev: MouseEvent) {
        const dx = ev.clientX - startX
        const dPct = (dx / gridWidth) * 100
        let newPct = startPct + dPct

        // Enforce min widths
        const minTermPct = (MIN_TERMINAL_WIDTH / gridWidth) * 100
        const maxTermPct = 100 - (MIN_RIGHT_WIDTH / gridWidth) * 100
        newPct = Math.max(minTermPct, Math.min(maxTermPct, newPct))

        setTerminalWidthPct(newPct)
      }

      function onMouseUp() {
        setDraggingH(false)
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [terminalWidthPct],
  )

  // Vertical divider drag (chart height within right column)
  const onVDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setDraggingV(true)

      const startY = e.clientY
      const startPct = chartHeightPct
      const grid = gridRef.current
      if (!grid) return
      const gridHeight = grid.clientHeight

      function onMouseMove(ev: MouseEvent) {
        const dy = ev.clientY - startY
        const dPct = (dy / gridHeight) * 100
        let newPct = startPct + dPct

        // Enforce min heights
        const minChartPct = (MIN_CHART_HEIGHT / gridHeight) * 100
        const maxChartPct = 100 - (MIN_SIDEBAR_HEIGHT / gridHeight) * 100
        newPct = Math.max(minChartPct, Math.min(maxChartPct, newPct))

        setChartHeightPct(newPct)
      }

      function onMouseUp() {
        setDraggingV(false)
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [chartHeightPct],
  )

  // Prevent text selection while dragging
  useEffect(() => {
    if (draggingH || draggingV) {
      document.body.style.cursor = draggingH ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [draggingH, draggingV])

  // Use fr units based on percentage ratios to avoid overflow from the 4px divider
  const termFr = terminalWidthPct
  const rightFr = 100 - terminalWidthPct
  const chartFr = chartHeightPct
  const sidebarFr = 100 - chartHeightPct

  return (
    <div className="layout-root">
      <div className="crt-overlay" />
      <TitleBar />

      <div
        ref={gridRef}
        className="panel-grid"
        style={{
          gridTemplateColumns: `60px ${termFr}fr 4px ${rightFr}fr 100px`,
          gridTemplateRows: '1fr',
        }}
      >
        {/* Watchlist (60px far-left) */}
        <div className="panel">{watchlist}</div>

        {/* Center Column: Chart + Chat stacked */}
        <div
          style={{
            display: 'grid',
            gridTemplateRows: `${chartFr}fr 4px ${sidebarFr}fr`,
            overflow: 'hidden',
            minWidth: 0,
            minHeight: 0,
          }}
        >
          {/* Chart Panel (top 2/3) */}
          <div
            className={`panel panel-chart${focusedPanel === 'chart' ? ' focused' : ''}`}
            tabIndex={0}
            onClick={() => setFocusedPanel('chart')}
            onFocus={() => setFocusedPanel('chart')}
          >
            {chart}
          </div>

          {/* Vertical Divider (chart / terminal) */}
          <div
            className={`divider divider-vertical${draggingV ? ' active' : ''}`}
            onMouseDown={onVDividerMouseDown}
          />

          {/* Chat Panel (bottom 40%) */}
          <div
            ref={chatPanelRef}
            className={`panel panel-chat${focusedPanel === 'chat' ? ' focused' : ''}`}
            tabIndex={0}
            onClick={() => setFocusedPanel('chat')}
            onFocus={() => setFocusedPanel('chat')}
          >
            {chat}
          </div>
        </div>

        {/* Horizontal Divider (left col / sidebar) */}
        <div
          className={`divider divider-horizontal${draggingH ? ' active' : ''}`}
          onMouseDown={onHDividerMouseDown}
        />

        {/* Guardian Sidebar (25%) */}
        <div
          className={`panel panel-sidebar${focusedPanel === 'sidebar' ? ' focused' : ''}`}
          tabIndex={0}
          onClick={() => setFocusedPanel('sidebar')}
          onFocus={() => setFocusedPanel('sidebar')}
        >
          {sidebar}
        </div>

        {/* Live Feed Strip (20%) */}
        <div className="panel panel-feed">
          {liveFeed}
        </div>
      </div>

      <StatusBar />
    </div>
  )
}
