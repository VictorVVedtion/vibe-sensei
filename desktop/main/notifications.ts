import { Notification } from 'electron'
import type { GuardianAlert } from '../shared/ipc-channels'

/**
 * Show a native desktop notification for a guardian alert.
 *
 * EMERGENCY/CRITICAL alerts use critical urgency (persistent on macOS).
 * INFO-level alerts are silent (no sound).
 */
export function showGuardianNotification(alert: GuardianAlert): void {
  if (!Notification.isSupported()) return

  const severity = alert.severity.toUpperCase()
  const urgency: 'critical' | 'normal' | 'low' =
    severity === 'EMERGENCY' || severity === 'CRITICAL' ? 'critical' : 'normal'

  const notification = new Notification({
    title: `${alert.masterName} — ${severity}`,
    body: alert.message,
    urgency,
    silent: severity === 'INFO',
  })

  notification.show()
}
