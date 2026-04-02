/**
 * Check registry — all risk checks registered here for the guardian engine.
 */

import type { CheckFn } from '../guardian.js'
import { checkPositionSize } from './position-size.js'
import { checkDrawdown } from './drawdown.js'

export interface RegisteredCheck {
  name: string
  fn: CheckFn
}

export const ALL_CHECKS: RegisteredCheck[] = [
  { name: 'position-size', fn: checkPositionSize },
  { name: 'drawdown', fn: checkDrawdown },
]
