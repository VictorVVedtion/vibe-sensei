/**
 * Native Installer — Stubbed for Vibe Sensei
 *
 * The native installer handled Anthropic's binary distribution.
 * All exports are no-op stubs to keep import sites intact.
 */

export type SetupMessage = {
  message: string
  userActionRequired: boolean
  type: 'path' | 'alias' | 'info' | 'error'
}

export async function checkInstall(
  _force: boolean = false,
): Promise<SetupMessage[]> {
  return []
}

export async function cleanupNpmInstallations(): Promise<{
  removed: number
  errors: string[]
  warnings: string[]
}> {
  return { removed: 0, errors: [], warnings: [] }
}

export async function cleanupOldVersions(): Promise<void> {}

export async function cleanupShellAliases(): Promise<SetupMessage[]> {
  return []
}

export function installLatest(
  _channelOrVersion: string,
  _forceReinstall: boolean = false,
): Promise<{
  latestVersion: string | null
  wasUpdated: boolean
  lockFailed?: boolean
  lockHolderPid?: number
}> {
  return Promise.resolve({
    latestVersion: null,
    wasUpdated: false,
  })
}

export async function lockCurrentVersion(): Promise<void> {}

export async function removeInstalledSymlink(): Promise<void> {}
