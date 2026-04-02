import * as pty from 'node-pty'
import { execSync } from 'child_process'
import * as path from 'path'

const MIN_COLS = 1
const MAX_COLS = 500
const MIN_ROWS = 1
const MAX_ROWS = 200

const MAX_RESTART_ATTEMPTS = 5
const BASE_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000
const STABLE_RUN_THRESHOLD_MS = 10000

export class PtyManager {
  private process: pty.IPty | null = null
  private onDataCallback: ((data: string) => void) | null = null
  private onExitCallback: ((exitCode: number) => void) | null = null

  private restartAttempts = 0
  private lastSpawnTime = 0
  private restartTimer: ReturnType<typeof setTimeout> | null = null

  spawn(): void {
    const projectRoot = path.resolve(__dirname, '..', '..')
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bun'
    const args =
      process.platform === 'win32'
        ? ['-Command', 'bun', 'run', 'src/entrypoints/cli.tsx']
        : ['run', 'src/entrypoints/cli.tsx']

    this.process = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: projectRoot,
      env: {
        ...process.env,
        VIBE_SENSEI_DESKTOP: '1',
        TERM: 'xterm-256color',
      },
    })

    this.lastSpawnTime = Date.now()

    this.process.onData((data: string) => {
      this.onDataCallback?.(data)
    })

    this.process.onExit(({ exitCode }) => {
      const code = exitCode ?? 1
      console.log(`PTY process exited with code ${code}`)
      this.process = null

      // Reset attempts if the process ran long enough to be considered stable
      if (Date.now() - this.lastSpawnTime >= STABLE_RUN_THRESHOLD_MS) {
        this.restartAttempts = 0
      }

      this.onExitCallback?.(code)
    })
  }

  onData(callback: (data: string) => void): void {
    this.onDataCallback = callback
  }

  onExit(callback: (exitCode: number) => void): void {
    this.onExitCallback = callback
  }

  write(data: string): void {
    this.process?.write(data)
  }

  resize(cols: number, rows: number): void {
    if (
      cols < MIN_COLS || cols > MAX_COLS ||
      rows < MIN_ROWS || rows > MAX_ROWS
    ) {
      return
    }
    this.process?.resize(cols, rows)
  }

  kill(): void {
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }

    if (!this.process) return

    const pid = this.process.pid
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${pid} /t /f`, { stdio: 'pipe' })
      } else {
        process.kill(-pid, 'SIGTERM')
      }
    } catch {
      // Process may already be dead — that's fine
    }

    try {
      this.process.kill()
    } catch {
      // Already killed via process group
    }

    this.process = null
  }

  restart(): { willRestart: boolean; attempt: number; delayMs: number } {
    if (this.restartAttempts >= MAX_RESTART_ATTEMPTS) {
      return { willRestart: false, attempt: this.restartAttempts, delayMs: 0 }
    }

    this.restartAttempts++
    const attempt = this.restartAttempts
    const delayMs = Math.min(
      BASE_BACKOFF_MS * Math.pow(2, attempt - 1),
      MAX_BACKOFF_MS,
    )

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      this.spawn()
    }, delayMs)

    return { willRestart: true, attempt, delayMs }
  }

  isAlive(): boolean {
    return this.process !== null
  }

  clearCallbacks(): void {
    this.onDataCallback = null
    this.onExitCallback = null
  }

  get isRunning(): boolean {
    return this.process !== null
  }

  get currentRestartAttempts(): number {
    return this.restartAttempts
  }
}
