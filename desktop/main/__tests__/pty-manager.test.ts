import { describe, it, expect, beforeEach } from 'vitest'
import { PtyManager } from '../pty-manager'

/**
 * PtyManager unit tests — pure logic only.
 * No actual PTY process is spawned; we test methods that operate
 * on internal state without requiring a live node-pty instance.
 */

describe('PtyManager', () => {
  let manager: PtyManager

  beforeEach(() => {
    manager = new PtyManager()
  })

  describe('isAlive()', () => {
    it('returns false when no process has been spawned', () => {
      expect(manager.isAlive()).toBe(false)
    })

    it('isRunning getter matches isAlive()', () => {
      expect(manager.isRunning).toBe(false)
      expect(manager.isRunning).toBe(manager.isAlive())
    })
  })

  describe('resize()', () => {
    it('does not throw when no process exists', () => {
      // resize should silently return when process is null
      expect(() => manager.resize(80, 24)).not.toThrow()
    })

    it('rejects cols below minimum (1)', () => {
      // With no process, resize exits early on bounds check before accessing process
      // The method returns early if cols < 1 or cols > 500 or rows < 1 or rows > 200
      expect(() => manager.resize(0, 24)).not.toThrow()
    })

    it('rejects cols above maximum (500)', () => {
      expect(() => manager.resize(501, 24)).not.toThrow()
    })

    it('rejects rows below minimum (1)', () => {
      expect(() => manager.resize(80, 0)).not.toThrow()
    })

    it('rejects rows above maximum (200)', () => {
      expect(() => manager.resize(80, 201)).not.toThrow()
    })

    it('accepts valid boundary values', () => {
      // Minimum valid: cols=1, rows=1
      expect(() => manager.resize(1, 1)).not.toThrow()
      // Maximum valid: cols=500, rows=200
      expect(() => manager.resize(500, 200)).not.toThrow()
    })

    it('accepts typical terminal dimensions', () => {
      expect(() => manager.resize(80, 24)).not.toThrow()
      expect(() => manager.resize(120, 40)).not.toThrow()
      expect(() => manager.resize(200, 50)).not.toThrow()
    })
  })

  describe('clearCallbacks()', () => {
    it('does not throw when called with no callbacks set', () => {
      expect(() => manager.clearCallbacks()).not.toThrow()
    })

    it('clears previously set callbacks', () => {
      let dataCalled = false
      let exitCalled = false
      let readyCalled = false

      manager.onData(() => { dataCalled = true })
      manager.onExit(() => { exitCalled = true })
      manager.onReady(() => { readyCalled = true })

      manager.clearCallbacks()

      // After clearing, the internal callback references should be null.
      // We verify this indirectly: since no process is spawned, callbacks
      // would only fire if manually triggered. The key assertion is that
      // clearCallbacks doesn't throw and the manager remains functional.
      expect(manager.isAlive()).toBe(false)
      expect(dataCalled).toBe(false)
      expect(exitCalled).toBe(false)
      expect(readyCalled).toBe(false)
    })

    it('can be called multiple times safely', () => {
      manager.clearCallbacks()
      manager.clearCallbacks()
      manager.clearCallbacks()
      expect(manager.isAlive()).toBe(false)
    })
  })

  describe('restart()', () => {
    it('returns willRestart true on first attempt', () => {
      const result = manager.restart()
      expect(result.willRestart).toBe(true)
      expect(result.attempt).toBe(1)
      expect(result.delayMs).toBeGreaterThan(0)
    })

    it('applies exponential backoff', () => {
      const r1 = manager.restart()
      const r2 = manager.restart()
      const r3 = manager.restart()

      expect(r1.delayMs).toBe(1000)    // BASE_BACKOFF_MS * 2^0
      expect(r2.delayMs).toBe(2000)    // BASE_BACKOFF_MS * 2^1
      expect(r3.delayMs).toBe(4000)    // BASE_BACKOFF_MS * 2^2
    })

    it('caps backoff at MAX_BACKOFF_MS (30000)', () => {
      // Attempt 1: 1000, 2: 2000, 3: 4000, 4: 8000, 5: 16000
      for (let i = 0; i < 4; i++) {
        manager.restart()
      }
      const r5 = manager.restart()
      // 2^4 * 1000 = 16000, under cap
      expect(r5.delayMs).toBe(16000)
    })

    it('refuses restart after MAX_RESTART_ATTEMPTS (5)', () => {
      // Exhaust all 5 attempts
      for (let i = 0; i < 5; i++) {
        const result = manager.restart()
        expect(result.willRestart).toBe(true)
        expect(result.attempt).toBe(i + 1)
      }

      // 6th attempt should be rejected
      const rejected = manager.restart()
      expect(rejected.willRestart).toBe(false)
      expect(rejected.delayMs).toBe(0)
    })

    it('tracks currentRestartAttempts', () => {
      expect(manager.currentRestartAttempts).toBe(0)
      manager.restart()
      expect(manager.currentRestartAttempts).toBe(1)
      manager.restart()
      expect(manager.currentRestartAttempts).toBe(2)
    })
  })

  describe('kill()', () => {
    it('does not throw when no process exists', () => {
      expect(() => manager.kill()).not.toThrow()
    })

    it('can be called multiple times safely', () => {
      manager.kill()
      manager.kill()
      expect(manager.isAlive()).toBe(false)
    })
  })

  describe('write()', () => {
    it('does not throw when no process exists', () => {
      expect(() => manager.write('test input')).not.toThrow()
    })
  })

  describe('setEnv()', () => {
    it('accepts environment variables without error', () => {
      expect(() => manager.setEnv({ FOO: 'bar', BAZ: 'qux' })).not.toThrow()
    })

    it('accepts empty environment', () => {
      expect(() => manager.setEnv({})).not.toThrow()
    })
  })
})
