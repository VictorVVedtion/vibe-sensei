import { useCallback, useEffect, useState } from 'react'

declare global {
  interface Window {
    electronAPI: {
      onPtyData: (callback: (data: string) => void) => void
      sendPtyInput: (data: string) => void
      sendPtyResize: (cols: number, rows: number) => void
      getUdfPort: () => Promise<number>
      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow: () => void
      isMaximized: () => Promise<boolean>
    }
  }
}

const isMac = navigator.userAgent.includes('Macintosh')

function MinimizeIcon() {
  return (
    <svg viewBox="0 0 10 10" width="10" height="10">
      <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
    </svg>
  )
}

function MaximizeIcon({ maximized }: { maximized: boolean }) {
  if (maximized) {
    return (
      <svg viewBox="0 0 10 10" width="10" height="10">
        <path
          d="M2 0h6v2h2v6H8v2H0V4h2V0zm1 1v2h5v5h1V2H3zm-2 3v5h6V4H1z"
          fill="currentColor"
          fillRule="evenodd"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 10 10" width="10" height="10">
      <rect
        x="0.5"
        y="0.5"
        width="9"
        height="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 10 10" width="10" height="10">
      <path
        d="M1 0L5 4L9 0L10 1L6 5L10 9L9 10L5 6L1 10L0 9L4 5L0 1Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function TitleBar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    window.electronAPI.isMaximized().then(setMaximized)
  }, [])

  const handleMinimize = useCallback(() => {
    window.electronAPI.minimizeWindow()
  }, [])

  const handleMaximize = useCallback(() => {
    window.electronAPI.maximizeWindow()
    // Toggle state optimistically, will be confirmed on next check
    setMaximized((prev) => !prev)
  }, [])

  const handleClose = useCallback(() => {
    window.electronAPI.closeWindow()
  }, [])

  return (
    <div className={`title-bar${isMac ? ' macos' : ''}`}>
      <div className="title-bar-left">
        <span className="app-icon">🐙</span>
        <span className="app-name">Vibe Sensei</span>
      </div>

      {/* Only show custom window controls on Windows/Linux */}
      {!isMac && (
        <div className="window-controls">
          <button
            className="window-control-btn minimize"
            onClick={handleMinimize}
            aria-label="Minimize"
          >
            <MinimizeIcon />
          </button>
          <button
            className="window-control-btn maximize"
            onClick={handleMaximize}
            aria-label={maximized ? 'Restore' : 'Maximize'}
          >
            <MaximizeIcon maximized={maximized} />
          </button>
          <button
            className="window-control-btn close"
            onClick={handleClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>
      )}
    </div>
  )
}
