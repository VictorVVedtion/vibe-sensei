/**
 * Package Manager Detection — Stubbed for Vibe Sensei
 *
 * Detects which package manager installed Claude.
 * All detection functions are preserved as they're used by doctorDiagnostic.ts.
 */

import { readFile } from 'fs/promises'
import memoize from 'lodash-es/memoize.js'
import { logForDebugging } from '../debug.js'
import { execFileNoThrow } from '../execFileNoThrow.js'
import { getPlatform } from '../platform.js'

export type PackageManager =
  | 'homebrew'
  | 'winget'
  | 'pacman'
  | 'deb'
  | 'rpm'
  | 'apk'
  | 'mise'
  | 'asdf'
  | 'unknown'

export const getOsRelease = memoize(
  async (): Promise<{ id: string; idLike: string[] } | null> => {
    try {
      const content = await readFile('/etc/os-release', 'utf8')
      const idMatch = content.match(/^ID=["']?(\S+?)["']?\s*$/m)
      const idLikeMatch = content.match(/^ID_LIKE=["']?(.+?)["']?\s*$/m)
      return {
        id: idMatch?.[1] ?? '',
        idLike: idLikeMatch?.[1]?.split(' ') ?? [],
      }
    } catch {
      return null
    }
  },
)

function isDistroFamily(
  osRelease: { id: string; idLike: string[] },
  families: string[],
): boolean {
  return (
    families.includes(osRelease.id) ||
    osRelease.idLike.some(like => families.includes(like))
  )
}

export function detectMise(): boolean {
  const execPath = process.execPath || process.argv[0] || ''
  if (/[/\\]mise[/\\]installs[/\\]/i.test(execPath)) {
    logForDebugging(`Detected mise installation: ${execPath}`)
    return true
  }
  return false
}

export function detectAsdf(): boolean {
  const execPath = process.execPath || process.argv[0] || ''
  if (/[/\\]\.?asdf[/\\]installs[/\\]/i.test(execPath)) {
    logForDebugging(`Detected asdf installation: ${execPath}`)
    return true
  }
  return false
}

export function detectHomebrew(): boolean {
  const platform = getPlatform()
  if (platform !== 'macos' && platform !== 'linux' && platform !== 'wsl') {
    return false
  }
  const execPath = process.execPath || process.argv[0] || ''
  if (execPath.includes('/Caskroom/')) {
    logForDebugging(`Detected Homebrew cask installation: ${execPath}`)
    return true
  }
  return false
}

export function detectWinget(): boolean {
  const platform = getPlatform()
  if (platform !== 'windows') {
    return false
  }
  const execPath = process.execPath || process.argv[0] || ''
  const wingetPatterns = [
    /Microsoft[/\\]WinGet[/\\]Packages/i,
    /Microsoft[/\\]WinGet[/\\]Links/i,
  ]
  for (const pattern of wingetPatterns) {
    if (pattern.test(execPath)) {
      logForDebugging(`Detected winget installation: ${execPath}`)
      return true
    }
  }
  return false
}

export const detectPacman = memoize(async (): Promise<boolean> => {
  const platform = getPlatform()
  if (platform !== 'linux') {
    return false
  }
  const osRelease = await getOsRelease()
  if (osRelease && !isDistroFamily(osRelease, ['arch'])) {
    return false
  }
  const execPath = process.execPath || process.argv[0] || ''
  const result = await execFileNoThrow('pacman', ['-Qo', execPath], {
    timeout: 5000,
    useCwd: false,
  })
  if (result.code === 0 && result.stdout) {
    logForDebugging(`Detected pacman installation: ${result.stdout.trim()}`)
    return true
  }
  return false
})

export const detectDeb = memoize(async (): Promise<boolean> => {
  const platform = getPlatform()
  if (platform !== 'linux') {
    return false
  }
  const osRelease = await getOsRelease()
  if (osRelease && !isDistroFamily(osRelease, ['debian'])) {
    return false
  }
  const execPath = process.execPath || process.argv[0] || ''
  const result = await execFileNoThrow('dpkg', ['-S', execPath], {
    timeout: 5000,
    useCwd: false,
  })
  if (result.code === 0 && result.stdout) {
    logForDebugging(`Detected deb installation: ${result.stdout.trim()}`)
    return true
  }
  return false
})

export const detectRpm = memoize(async (): Promise<boolean> => {
  const platform = getPlatform()
  if (platform !== 'linux') {
    return false
  }
  const osRelease = await getOsRelease()
  if (osRelease && !isDistroFamily(osRelease, ['fedora', 'rhel', 'suse'])) {
    return false
  }
  const execPath = process.execPath || process.argv[0] || ''
  const result = await execFileNoThrow('rpm', ['-qf', execPath], {
    timeout: 5000,
    useCwd: false,
  })
  if (result.code === 0 && result.stdout) {
    logForDebugging(`Detected rpm installation: ${result.stdout.trim()}`)
    return true
  }
  return false
})

export const detectApk = memoize(async (): Promise<boolean> => {
  const platform = getPlatform()
  if (platform !== 'linux') {
    return false
  }
  const osRelease = await getOsRelease()
  if (osRelease && !isDistroFamily(osRelease, ['alpine'])) {
    return false
  }
  const execPath = process.execPath || process.argv[0] || ''
  const result = await execFileNoThrow(
    'apk',
    ['info', '--who-owns', execPath],
    {
      timeout: 5000,
      useCwd: false,
    },
  )
  if (result.code === 0 && result.stdout) {
    logForDebugging(`Detected apk installation: ${result.stdout.trim()}`)
    return true
  }
  return false
})

export const getPackageManager = memoize(async (): Promise<PackageManager> => {
  if (detectHomebrew()) {
    return 'homebrew'
  }
  if (detectWinget()) {
    return 'winget'
  }
  if (detectMise()) {
    return 'mise'
  }
  if (detectAsdf()) {
    return 'asdf'
  }
  if (await detectPacman()) {
    return 'pacman'
  }
  if (await detectApk()) {
    return 'apk'
  }
  if (await detectDeb()) {
    return 'deb'
  }
  if (await detectRpm()) {
    return 'rpm'
  }
  return 'unknown'
})
