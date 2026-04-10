/**
 * PID-Based Version Locking — Stubbed for Vibe Sensei
 *
 * No-op stubs for PID-based locking used by Doctor screen.
 */

export type VersionLockContent = {
  pid: number
  version: string
  execPath: string
  acquiredAt: number
}

export type LockInfo = {
  version: string
  pid: number
  isProcessRunning: boolean
  execPath: string
  acquiredAt: Date
  lockFilePath: string
}

export function isPidBasedLockingEnabled(): boolean {
  return false
}

export function isProcessRunning(_pid: number): boolean {
  return false
}

export function readLockContent(
  _lockFilePath: string,
): VersionLockContent | null {
  return null
}

export function isLockActive(_lockFilePath: string): boolean {
  return false
}

export function getAllLockInfo(_locksDir: string): LockInfo[] {
  return []
}

export function cleanupStaleLocks(_locksDir: string): number {
  return 0
}

export async function tryAcquireLock(
  _versionPath: string,
  _lockFilePath: string,
): Promise<(() => void) | null> {
  return null
}

export async function acquireProcessLifetimeLock(
  _versionPath: string,
  _lockFilePath: string,
): Promise<boolean> {
  return false
}

export async function withLock(
  _versionPath: string,
  _lockFilePath: string,
  _callback: () => void | Promise<void>,
): Promise<boolean> {
  return false
}
