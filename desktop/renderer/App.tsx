import { TerminalPanel } from './components/TerminalPanel'
import { ChartPanel } from './components/ChartPanel'

export function App() {
  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'row',
        background: '#0a0a0a',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
        <TerminalPanel />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
        <ChartPanel />
      </div>
    </div>
  )
}
