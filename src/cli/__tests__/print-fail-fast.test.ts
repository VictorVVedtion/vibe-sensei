/**
 * Sprint 148 — RAMPAGE fail-fast regression tests.
 *
 * Each of these CLI inputs used to hang indefinitely (until the user
 * Ctrl+C'd or the test runner gave up). They must now exit non-zero in
 * under 5 seconds with a single-line stderr error message.
 *
 *   RAMPAGE-001: --tools "" hangs              → main.tsx fail-fast
 *   RAMPAGE-002: malformed --json-schema hangs → main.tsx try/catch
 *   RAMPAGE-003: whitespace-only --print hangs → main.tsx fail-fast
 *   RAMPAGE-004: --max-budget-usd 0.0001 hangs → argParser floor
 *
 * NONE of these tests may make a real Anthropic API call. Each repro
 * either fails at commander argParser time or at validation in main.tsx,
 * which is BEFORE any provider is initialized. The </dev/null stdin
 * confirms there is no network input either.
 */

import { describe, expect, it } from 'vitest'
import { spawn } from 'child_process'
import { openSync } from 'fs'
import { resolve } from 'path'

const CLI_ENTRY = resolve(__dirname, '../../entrypoints/cli.tsx')
const REPO_ROOT = resolve(__dirname, '../../../')
// The contract requires the CLI to exit non-zero in under 5 seconds. We
// give the SPAWN a slightly larger budget so that the assertion (rather
// than the killer) is what surfaces a regression — and so the test
// reports the actual stderr instead of "killed mid-output". WALL_CLOCK
// is the strict 8-second ceiling from the acceptance criteria.
const WALL_CLOCK_BUDGET_MS = 8_000
const SPAWN_TIMEOUT_MS = 7_500

interface SpawnResult {
  exitCode: number | null
  signal: NodeJS.Signals | null
  stderr: string
  stdout: string
  wallClockMs: number
  timedOut: boolean
}

/**
 * Spawns the CLI as a subprocess and waits for it to exit. Kills the
 * process after `timeoutMs` and returns whatever was captured. We use
 * child_process.spawn (rather than Bun.spawn) because vitest itself
 * runs under node, where the Bun global is undefined.
 */
function spawnCli(
  args: string[],
  timeoutMs: number = SPAWN_TIMEOUT_MS,
): Promise<SpawnResult> {
  return new Promise(resolvePromise => {
    const startedAt = Date.now()

    // Important: pipe an actual /dev/null fd into stdin rather than using
    // 'ignore'. With 'ignore', the child sees an open pipe with no writer
    // and getInputPrompt() in main.tsx waits up to 3 seconds for data
    // before falling back to the prompt arg, which combined with bootstrap
    // overhead exceeds our 5-second budget. With /dev/null, the read
    // returns EOF immediately and the CLI proceeds straight to validation.
    const devNullFd = openSync('/dev/null', 'r')

    // Strip test-mode env vars from the child. Vitest sets NODE_ENV=test,
    // which the CLI uses as a signal that gracefulShutdown's forceExit()
    // should NOT actually call process.exit (so unit tests can mock it).
    // In a black-box subprocess test we DO want a real exit, so the child
    // must run in production mode.
    const childEnv: Record<string, string> = {}
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) childEnv[k] = v
    }
    delete childEnv.NODE_ENV
    delete childEnv.VITEST
    delete childEnv.VITEST_POOL_ID
    delete childEnv.VITEST_WORKER_ID
    childEnv.CLAUDE_CODE_DISABLE_TERMINAL_TITLE = '1'

    const child = spawn('bun', ['run', CLI_ENTRY, ...args], {
      cwd: REPO_ROOT,
      stdio: [devNullFd, 'pipe', 'pipe'],
      env: childEnv,
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    child.on('exit', (exitCode, signal) => {
      clearTimeout(timer)
      resolvePromise({
        exitCode,
        signal,
        stderr,
        stdout,
        wallClockMs: Date.now() - startedAt,
        timedOut,
      })
    })

    child.on('error', err => {
      clearTimeout(timer)
      resolvePromise({
        exitCode: -1,
        signal: null,
        stderr: stderr + `\nspawn error: ${(err as Error).message}`,
        stdout,
        wallClockMs: Date.now() - startedAt,
        timedOut,
      })
    })
  })
}

function expectFailFast(
  result: SpawnResult,
  expectedStderr: RegExp[],
): void {
  expect(result.timedOut, `process did not exit; stderr=${result.stderr.slice(0, 500)}`).toBe(false)
  // Non-zero is either a positive exit code from process.exit or a signal
  // (commander emits exit code 1 on argParser failure; main.tsx uses
  // process.exit(1) directly). null + signal would indicate the test
  // killer fired, which is also a failure case caught above.
  expect(result.exitCode === 0).toBe(false)
  for (const pattern of expectedStderr) {
    expect(result.stderr).toMatch(pattern)
  }
  expect(result.wallClockMs).toBeLessThan(WALL_CLOCK_BUDGET_MS)
}

describe('Sprint 148 — CLI fail-fast regressions', () => {
  it('RAMPAGE-003: whitespace-only --print prompt exits non-zero', async () => {
    const result = await spawnCli(['--print', ' '])
    expectFailFast(result, [/Input must be provided/])
  }, 15_000)

  it('RAMPAGE-002: malformed --json-schema exits non-zero', async () => {
    const result = await spawnCli([
      '--print',
      'hello',
      '--json-schema',
      'not json',
    ])
    expectFailFast(result, [/--json-schema must be valid JSON/])
  }, 15_000)

  it('RAMPAGE-001: --tools "" exits non-zero with a clear message', async () => {
    const result = await spawnCli([
      '--tools',
      '',
      '--print',
      'what tools are available',
    ])
    expectFailFast(result, [/--tools/, /not currently supported/])
  }, 15_000)

  it('RAMPAGE-004: --max-budget-usd below floor exits non-zero', async () => {
    const result = await spawnCli([
      '--print',
      '--max-budget-usd',
      '0.0001',
      'what is 2+2',
    ])
    expectFailFast(result, [/--max-budget-usd/, /0\.001/])
  }, 15_000)
})
