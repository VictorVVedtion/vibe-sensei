import * as pty from 'node-pty'
import * as path from 'path'

export class PtyManager {
  private process: pty.IPty | null = null
  private onDataCallback: ((data: string) => void) | null = null

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

    this.process.onData((data: string) => {
      this.onDataCallback?.(data)
    })

    this.process.onExit(({ exitCode }) => {
      console.log(`PTY process exited with code ${exitCode}`)
      this.process = null
    })
  }

  onData(callback: (data: string) => void): void {
    this.onDataCallback = callback
  }

  write(data: string): void {
    this.process?.write(data)
  }

  resize(cols: number, rows: number): void {
    if (cols > 0 && rows > 0) {
      this.process?.resize(cols, rows)
    }
  }

  kill(): void {
    this.process?.kill()
    this.process = null
  }

  get isRunning(): boolean {
    return this.process !== null
  }
}
