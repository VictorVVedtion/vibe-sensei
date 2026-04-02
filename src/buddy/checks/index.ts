/**
 * Check registry — all risk checks registered here for the guardian engine.
 */

import type { CheckFn } from '../guardian.js'
import { checkPositionSize } from './position-size.js'
import { checkDrawdown } from './drawdown.js'
import { checkLeverage } from './leverage.js'
import { checkConcentration } from './concentration.js'
import { checkOrderValidation } from './order-validation.js'
import { checkBehavioralPatterns } from './behavioral-patterns.js'

export interface RegisteredCheck {
  name: string
  /** Key into the ThresholdConfig map. Null means no dynamic thresholds (e.g. order-validation). */
  thresholdKey: string | null
  fn: CheckFn
}

export const ALL_CHECKS: RegisteredCheck[] = [
  { name: 'position-size', thresholdKey: 'position_size', fn: checkPositionSize },
  { name: 'drawdown', thresholdKey: 'drawdown', fn: checkDrawdown },
  { name: 'leverage', thresholdKey: 'leverage', fn: checkLeverage },
  { name: 'concentration', thresholdKey: 'concentration', fn: checkConcentration },
  { name: 'order-validation', thresholdKey: null, fn: checkOrderValidation },
  { name: 'behavioral-patterns', thresholdKey: null, fn: checkBehavioralPatterns },
]
