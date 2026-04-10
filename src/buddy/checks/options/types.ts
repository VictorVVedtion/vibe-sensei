/**
 * Shared types for options guardian checks.
 */

export type OptionsCheckSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export interface OptionsCheckResult {
  name: string
  severity: OptionsCheckSeverity
  message: string
  passed: boolean
}
