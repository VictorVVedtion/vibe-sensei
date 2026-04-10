/**
 * Contract Audit Check — warns when interacting with unaudited contracts.
 *
 * Thresholds:
 *   - PASS: isContractAudited === true
 *   - WARNING: isContractAudited === undefined (unknown)
 *   - CRITICAL: isContractAudited === false
 *
 * Uses VerticalContext.isContractAudited from the DeFi vertical.
 */

import type { VerticalContext } from '../../verticals.js'
import type { RiskAlert, Severity } from '../../guardian.js'

export function checkContractAudit(
  ctx: VerticalContext,
  masterId: string,
  masterName: string,
  masterQuote: string,
): RiskAlert | null {
  if (ctx.vertical !== 'defi_dex') return null

  let severity: Severity | null = null

  if (ctx.isContractAudited === false) {
    severity = 'CRITICAL'
  } else if (ctx.isContractAudited === undefined) {
    severity = 'WARNING'
  }

  if (severity === null) return null

  const status = ctx.isContractAudited === false ? 'UNAUDITED' : 'unknown audit status'
  return {
    severity,
    masterId,
    masterName,
    message: `${masterName}: Contract has ${status}. "${masterQuote}"`,
    checkName: 'contract-audit',
    timestamp: new Date(),
  }
}
