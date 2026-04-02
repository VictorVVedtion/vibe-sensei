/**
 * Check registry — all risk checks registered here for the guardian engine.
 */

import type { CheckFn } from '../guardian.js'
import { checkPositionSize } from './position-size.js'
import { checkDrawdown } from './drawdown.js'
import { checkLeverage } from './leverage.js'
import { checkConcentration } from './concentration.js'
import { checkOrderValidation } from './order-validation.js'

export interface RegisteredCheck {
  name: string
  fn: CheckFn
}

export const ALL_CHECKS: RegisteredCheck[] = [
  { name: 'position-size', fn: checkPositionSize },
  { name: 'drawdown', fn: checkDrawdown },
  { name: 'leverage', fn: checkLeverage },
  { name: 'concentration', fn: checkConcentration },
  { name: 'order-validation', fn: checkOrderValidation },
]
