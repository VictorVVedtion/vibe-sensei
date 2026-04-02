import { TerminalPanel } from './components/TerminalPanel'

export function App() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a0a',
      }}
    >
      <TerminalPanel />
    </div>
  )
}
