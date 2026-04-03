/**
 * Knowledge Base Event Type Definitions.
 *
 * Defines 7 event types emitted by the trading system:
 * TradeLogEvent, AlertEvent, GhostEvent, RegimeChangeEvent,
 * CircuitBreakerEvent, GateCheckEvent, DiaryPatternEvent.
 *
 * Each event extends a base KBEvent with type, timestamp, and UUID id.
 * Zod schemas provide runtime validation for JSONL read-back.
 */

import { z } from 'zod/v4'

// ── Base Event Schema ─────────────────────────────────────────────────────────

export const KBEventBaseSchema = z.object({
  id: z.string(),
  type: z.string(),
  timestamp: z.string(),
})

export interface KBEvent {
  id: string
  type: string
  timestamp: string
}

// ── TradeLogEvent ─────────────────────────────────────────────────────────────

export const TradeLogEventSchema = KBEventBaseSchema.extend({
  type: z.literal('trade_log'),
  symbol: z.string(),
  side: z.string(),
  quantity: z.number(),
  price: z.number(),
  orderType: z.string().optional(),
  grossPnL: z.number().optional(),
  netPnL: z.number().optional(),
  rMultiple: z.number().optional(),
  holdDurationMs: z.number().optional(),
  fees: z.number().optional(),
})

export type TradeLogEvent = z.infer<typeof TradeLogEventSchema>

// ── AlertEvent ────────────────────────────────────────────────────────────────

export const AlertEventSchema = KBEventBaseSchema.extend({
  type: z.literal('alert'),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL', 'EMERGENCY']),
  masterName: z.string(),
  checkName: z.string(),
  message: z.string(),
  symbol: z.string().optional(),
})

export type AlertEvent = z.infer<typeof AlertEventSchema>

// ── GhostEvent ────────────────────────────────────────────────────────────────

export const GhostEventSchema = KBEventBaseSchema.extend({
  type: z.literal('ghost'),
  ghostId: z.string(),
  ghostName: z.string(),
  triggerReason: z.string(),
})

export type GhostEvent = z.infer<typeof GhostEventSchema>

// ── RegimeChangeEvent ─────────────────────────────────────────────────────────

export const RegimeChangeEventSchema = KBEventBaseSchema.extend({
  type: z.literal('regime_change'),
  symbol: z.string(),
  oldRegime: z.string(),
  newRegime: z.string(),
  confidence: z.number(),
})

export type RegimeChangeEvent = z.infer<typeof RegimeChangeEventSchema>

// ── CircuitBreakerEvent ───────────────────────────────────────────────────────

export const CircuitBreakerEventSchema = KBEventBaseSchema.extend({
  type: z.literal('circuit_breaker'),
  breakerType: z.enum(['trade_recorded', 'loss_recorded', 'win_recorded']),
  details: z.record(z.string(), z.unknown()).optional(),
})

export type CircuitBreakerEvent = z.infer<typeof CircuitBreakerEventSchema>

// ── GateCheckEvent ────────────────────────────────────────────────────────────

export const GateCheckEventSchema = KBEventBaseSchema.extend({
  type: z.literal('gate_check'),
  symbol: z.string(),
  side: z.string(),
  status: z.enum(['pass', 'warn', 'fail']),
  failCount: z.number(),
  warnCount: z.number(),
})

export type GateCheckEvent = z.infer<typeof GateCheckEventSchema>

// ── DiaryPatternEvent ─────────────────────────────────────────────────────────

export const DiaryPatternEventSchema = KBEventBaseSchema.extend({
  type: z.literal('diary_pattern'),
  entryId: z.string(),
  symbol: z.string(),
  side: z.string(),
  patternType: z.string(),
  outcome: z.string().optional(),
})

export type DiaryPatternEvent = z.infer<typeof DiaryPatternEventSchema>

// ── Union Schema ──────────────────────────────────────────────────────────────

export const KBEventSchema = z.union([
  TradeLogEventSchema,
  AlertEventSchema,
  GhostEventSchema,
  RegimeChangeEventSchema,
  CircuitBreakerEventSchema,
  GateCheckEventSchema,
  DiaryPatternEventSchema,
])

export type KBEventUnion =
  | TradeLogEvent
  | AlertEvent
  | GhostEvent
  | RegimeChangeEvent
  | CircuitBreakerEvent
  | GateCheckEvent
  | DiaryPatternEvent
