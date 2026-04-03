/**
 * Companion Engine Singleton — global lifecycle management.
 *
 * Provides a single shared CompanionEngine instance that integrates with
 * the AppState store via companionReaction. The engine is started once
 * during initialization and stopped on shutdown.
 *
 * Usage:
 *   import { initCompanionEngine, stopCompanionEngine, getCompanionEngine } from './singleton.js'
 *
 *   // During app initialization (e.g. REPL mount, query.ts init):
 *   initCompanionEngine(store.setState)
 *
 *   // During shutdown:
 *   stopCompanionEngine()
 *
 *   // From guardian-observer after trade events:
 *   getCompanionEngine()?.handleTradingEvent(event)
 */

import type { AppState } from '../../state/AppStateStore.js'
import { getCompanion } from '../../buddy/companion.js'
import { getMasterArchetype } from '../../buddy/persona.js'
import { MASTER_NAMES, type Master } from '../../buddy/types.js'
import { CompanionEngine } from './engine.js'
import type { CompanionConfig, CompanionStatus, TradingEvent } from './types.js'

// ── Singleton State ───────────────────────────────────────────────────────

let engineInstance: CompanionEngine | null = null
let storedSetState: ((updater: (prev: AppState) => AppState) => void) | null = null

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Initialize and start the companion engine.
 *
 * Connects proactive messages to AppState via the provided setState function.
 * Safe to call multiple times — subsequent calls are no-ops if already running.
 *
 * @param setState - AppState updater function (from store.setState)
 * @param config - Optional configuration overrides
 */
export function initCompanionEngine(
  setState: (updater: (prev: AppState) => AppState) => void,
  config?: Partial<CompanionConfig>,
): void {
  if (engineInstance) return // already initialized

  const companion = getCompanion()
  if (!companion) return // no companion assigned

  const masterId = companion.species as Master
  const archetype = getMasterArchetype(masterId)
  const masterName = MASTER_NAMES[masterId] ?? companion.name ?? 'Trading Master'

  const fullConfig: CompanionConfig = {
    enabled: true,
    proactiveEnabled: true,
    cooldownMs: 300_000,
    sessionStartTime: Date.now(),
    ...config,
  }

  const pushMessage = (message: string): void => {
    setState((prev) => {
      if (prev.companionReaction === message) return prev
      return { ...prev, companionReaction: message }
    })
  }

  engineInstance = new CompanionEngine(fullConfig, archetype, pushMessage, masterName)
  engineInstance.start()
}

/**
 * Stop the companion engine and release resources.
 * Safe to call even if not initialized.
 */
export function stopCompanionEngine(): void {
  if (!engineInstance) return
  engineInstance.stop()
  engineInstance = null
}

/**
 * Get the current companion engine instance, or null if not initialized.
 * Used by guardian-observer to forward trading events.
 */
export function getCompanionEngine(): CompanionEngine | null {
  return engineInstance
}

/**
 * Get the engine status, or null if not initialized.
 */
export function getCompanionStatus(): CompanionStatus | null {
  if (!engineInstance) return null
  return engineInstance.getStatus()
}

/**
 * Forward a trading event to the companion engine.
 * If the engine is not yet initialized, attempts lazy initialization
 * using the stored setState reference.
 */
export function notifyTradingEvent(event: TradingEvent): void {
  // Lazy initialization on first trading event
  if (!engineInstance && storedSetState) {
    initCompanionEngine(storedSetState)
  }
  if (!engineInstance) return
  engineInstance.handleTradingEvent(event)
}

/**
 * Register the AppState setter for lazy initialization.
 * Called once from REPL or query initialization. The engine
 * won't start until the first trading event arrives.
 */
export function registerAppStateSetter(
  setState: (updater: (prev: AppState) => AppState) => void,
): void {
  storedSetState = setState
}
