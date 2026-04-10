import { z } from 'zod'

export const IPC = {
  UDF_PORT: 'udf:port',
  UDF_IS_READY: 'udf:isReady',
  UDF_READY: 'udf:ready',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',
  // Guardian & Trading IPC channels
  TRADING_STATE: 'trading:state',
  TRADING_STATE_REQUEST: 'trading:state:request',
  GUARDIAN_ALERT: 'guardian:alert',
  GUARDIAN_ALERT_NOTIFY: 'guardian:alert:notify',
  GUARDIAN_MASTER: 'guardian:master',
  GUARDIAN_MASTER_REQUEST: 'guardian:master:request',
  // Phase 16: Companion & extended channels
  COMPANION_EMOTION: 'companion:emotion',
  COMPANION_EMOTION_REQUEST: 'companion:emotion:request',
  COMPANION_SPEECH: 'companion:speech',
  TILT_STATE: 'tilt:state',
  PLAYBOOK_CARD: 'playbook:card',
  PLAYBOOK_EXECUTE: 'playbook:execute',
  TRADE_REVIEW: 'trade:review',
  ANTI_PORTFOLIO: 'anti:portfolio',
  COUNCIL_DEBATE: 'council:debate',
  NEWS_ALERT: 'news:alert',
  CHART_CONTEXT: 'chart:context',
  TRADE_HISTORY: 'trade:history',
  TRADE_HISTORY_REQUEST: 'trade:history:request',
  // Layout persistence
  LAYOUT_STATE_REQUEST: 'layout:state:request',
  // Sprint 100: Cross-venue portfolio
  CROSS_VENUE_PORTFOLIO: 'portfolio:cross_venue',
  VENUE_STATUS: 'venue:status',
  // Sprint 102: Weekly Review & Risk Map
  WEEKLY_REVIEW: 'weekly:review',
  WEEKLY_REVIEW_REQUEST: 'weekly:review:request',
  RISK_MAP: 'risk:map',
  RISK_MAP_REQUEST: 'risk:map:request',
} as const

// ── Zod validation schemas ─────────────────────────────────────────────────

export const TradingPositionSchema = z.object({
  symbol: z.string(),
  side: z.enum(['buy', 'sell']),
  quantity: z.number(),
  entryPrice: z.number(),
  currentPrice: z.number(),
  unrealizedPnl: z.number(),
  unrealizedPnlPercent: z.number(),
})

export const TradingBalanceSchema = z.object({
  currency: z.string(),
  free: z.number(),
  used: z.number(),
  total: z.number(),
})

export const TradingStateSchema = z.object({
  positions: z.array(TradingPositionSchema),
  balances: z.array(TradingBalanceSchema),
  totalPortfolioValue: z.number(),
  riskScore: z.number(),
  timestamp: z.number(),
})

export const GuardianAlertSchema = z.object({
  id: z.string(),
  severity: z.enum(['info', 'warning', 'critical', 'emergency']),
  masterName: z.string(),
  message: z.string(),
  checkName: z.string().optional(),
  timestamp: z.number(),
})

export const MasterInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
  archetype: z.string(),
  quote: z.string(),
  stats: z.object({
    PRECISION: z.number(),
    PATIENCE: z.number(),
    AGGRESSION: z.number(),
    WISDOM: z.number(),
    SASS: z.number(),
  }),
})

// ── Phase 16: Extended Zod schemas ────────────────────────────────────────

export const CompanionEmotionSchema = z.object({
  emotion: z.string(),
  intensity: z.number().min(0).max(1),
  trigger: z.string().optional(),
  timestamp: z.number(),
})

export const CompanionSpeechSchema = z.object({
  message: z.string(),
  emotion: z.string(),
  masterName: z.string(),
  duration: z.number().optional(),
  timestamp: z.number(),
})

export const TiltStateSchema = z.object({
  level: z.enum(['none', 'mild', 'moderate', 'severe', 'critical']),
  score: z.number().min(0).max(100),
  triggers: z.array(z.string()),
  recommendation: z.string(),
  timestamp: z.number(),
})

export const PlaybookCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  conditions: z.array(z.string()),
  actions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  timestamp: z.number(),
})

export const TradeReviewSchema = z.object({
  tradeId: z.string(),
  symbol: z.string(),
  side: z.enum(['buy', 'sell']),
  entryPrice: z.number(),
  exitPrice: z.number().optional(),
  pnl: z.number().optional(),
  masterVerdict: z.string(),
  lessons: z.array(z.string()),
  timestamp: z.number(),
})

export const AntiPortfolioSchema = z.object({
  entries: z.array(
    z.object({
      symbol: z.string(),
      reason: z.string(),
      missedPnl: z.number().optional(),
      date: z.string(),
    }),
  ),
  weeklyBlocked: z.number().optional(),
  weeklySavedAmount: z.number().optional(),
  monthlyBlocked: z.number().optional(),
  monthlySavedAmount: z.number().optional(),
  masterName: z.string().optional(),
  timestamp: z.number(),
})

export const CouncilDebateSchema = z.object({
  topic: z.string(),
  participants: z.array(
    z.object({
      masterName: z.string(),
      position: z.enum(['for', 'against', 'neutral']),
      argument: z.string(),
      spriteId: z.string().optional(),
    }),
  ),
  verdict: z.string().optional(),
  recommendation: z.enum(['reduce', 'hold', 'watch']).optional(),
  source: z.enum(['council', 'debate']).optional(),
  timestamp: z.number(),
})

export const NewsAlertSchema = z.object({
  id: z.string(),
  headline: z.string(),
  source: z.string(),
  sentiment: z.enum(['bullish', 'bearish', 'neutral']),
  relevantSymbols: z.array(z.string()),
  timestamp: z.number(),
})

export const ChartContextSchema = z.object({
  symbol: z.string(),
  timeframe: z.string(),
  visibleRange: z.object({
    from: z.number(),
    to: z.number(),
  }),
  indicators: z.array(z.string()).optional(),
  drawings: z.array(z.string()).optional(),
  timestamp: z.number(),
})

export const TradeHistorySchema = z.object({
  trades: z.array(
    z.object({
      id: z.string(),
      symbol: z.string(),
      side: z.enum(['buy', 'sell']),
      quantity: z.number(),
      price: z.number(),
      timestamp: z.number(),
      pnl: z.number().optional(),
      patternType: z.string().optional(),
      observation: z.string().optional(),
      outcome: z.enum(['profit', 'loss', 'pending']).optional(),
      holdDurationMs: z.number().optional(),
    }),
  ),
  timestamp: z.number(),
})

// ── Sprint 100: Cross-venue portfolio Zod schemas ─────────────────────────

export const CrossVenueAssetEntrySchema = z.object({
  asset: z.string(),
  valueUSD: z.number(),
})

export const CrossVenueVenueEntrySchema = z.object({
  venueId: z.string(),
  valueUSD: z.number(),
})

export const CrossVenuePortfolioSchema = z.object({
  totalUSD: z.number(),
  perVenue: z.array(CrossVenueVenueEntrySchema),
  perAsset: z.array(CrossVenueAssetEntrySchema),
  concentrationAlerts: z.array(z.string()),
  timestamp: z.number(),
})

export const VenueHealthEntrySchema = z.object({
  venueId: z.string(),
  vertical: z.string(),
  connected: z.boolean(),
  lastHealthCheck: z.number(),
  error: z.string().optional(),
})

export const VenueStatusSchema = z.object({
  venues: z.array(VenueHealthEntrySchema),
  connectedCount: z.number(),
  totalCount: z.number(),
  timestamp: z.number(),
})

// ── Sprint 102: Weekly Review & Risk Map Zod schemas ────────────────────────

export const WeeklyReviewVenueSchema = z.object({
  venue: z.string(),
  tradeCount: z.number(),
  wins: z.number(),
  losses: z.number(),
  winRate: z.number(),
  avgRMultiple: z.number(),
  expectancy: z.number(),
  totalPnl: z.number(),
})

export const WeeklyReviewTrendSchema = z.object({
  vertical: z.string(),
  currentWinRate: z.number(),
  previousWinRate: z.number(),
  trend: z.enum(['improving', 'regressing', 'stable', 'new']),
})

export const WeeklyReviewSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  masterName: z.string(),
  totalTrades: z.number(),
  overallWinRate: z.number(),
  overallExpectancy: z.number(),
  perVenue: z.array(WeeklyReviewVenueSchema),
  verticalTrends: z.array(WeeklyReviewTrendSchema),
  guardianCommentary: z.string(),
  timestamp: z.number(),
})

export const RiskMapBubbleSchema = z.object({
  symbol: z.string(),
  venue: z.string(),
  notional: z.number(),
  liquidationDistance: z.number(),
  side: z.enum(['buy', 'sell']),
  unrealizedPnlPercent: z.number(),
})

export const RiskMapDataSchema = z.object({
  bubbles: z.array(RiskMapBubbleSchema),
  timestamp: z.number(),
})

// ── Guardian/Trading IPC payload types ──────────────────────────────────────

export interface TradingPosition {
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  entryPrice: number
  currentPrice: number
  unrealizedPnl: number
  unrealizedPnlPercent: number
}

export interface TradingBalance {
  currency: string
  free: number
  used: number
  total: number
}

export interface TradingState {
  positions: TradingPosition[]
  balances: TradingBalance[]
  totalPortfolioValue: number
  riskScore: number
  timestamp: number
}

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency'

export interface GuardianAlert {
  id: string
  severity: AlertSeverity
  masterName: string
  message: string
  timestamp: number
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface MasterInfo {
  id: string
  name: string
  rarity: Rarity
  archetype: string
  quote: string
  stats: {
    PRECISION: number
    PATIENCE: number
    AGGRESSION: number
    WISDOM: number
    SASS: number
  }
}

// ── Phase 16: Extended payload types ──────────────────────────────────────

export type TiltLevel = 'none' | 'mild' | 'moderate' | 'severe' | 'critical'
export type DebatePosition = 'for' | 'against' | 'neutral'
export type NewsSentiment = 'bullish' | 'bearish' | 'neutral'

export interface CompanionEmotion {
  emotion: string
  intensity: number
  trigger?: string
  timestamp: number
}

export interface CompanionSpeech {
  message: string
  emotion: string
  masterName: string
  duration?: number
  timestamp: number
}

export interface TiltState {
  level: TiltLevel
  score: number
  triggers: string[]
  recommendation: string
  timestamp: number
}

export interface PlaybookCard {
  id: string
  name: string
  description: string
  conditions: string[]
  actions: string[]
  confidence: number
  timestamp: number
}

export interface TradeReview {
  tradeId: string
  symbol: string
  side: 'buy' | 'sell'
  entryPrice: number
  exitPrice?: number
  pnl?: number
  masterVerdict: string
  lessons: string[]
  timestamp: number
}

export interface AntiPortfolioEntry {
  symbol: string
  reason: string
  missedPnl?: number
  date: string
}

export interface AntiPortfolio {
  entries: AntiPortfolioEntry[]
  weeklyBlocked?: number
  weeklySavedAmount?: number
  monthlyBlocked?: number
  monthlySavedAmount?: number
  masterName?: string
  timestamp: number
}

export interface CouncilParticipant {
  masterName: string
  position: DebatePosition
  argument: string
  spriteId?: string
}

export type CouncilRecommendation = 'reduce' | 'hold' | 'watch'
export type CouncilSource = 'council' | 'debate'

export interface CouncilDebate {
  topic: string
  participants: CouncilParticipant[]
  verdict?: string
  recommendation?: CouncilRecommendation
  source?: CouncilSource
  timestamp: number
}

export interface NewsAlert {
  id: string
  headline: string
  source: string
  sentiment: NewsSentiment
  relevantSymbols: string[]
  timestamp: number
}

export interface ChartContext {
  symbol: string
  timeframe: string
  visibleRange: {
    from: number
    to: number
  }
  indicators?: string[]
  drawings?: string[]
  timestamp: number
}

export interface TradeHistoryEntry {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  timestamp: number
  pnl?: number
  patternType?: string
  observation?: string
  outcome?: 'profit' | 'loss' | 'pending'
  holdDurationMs?: number
}

export interface TradeHistory {
  trades: TradeHistoryEntry[]
  timestamp: number
}

export interface LayoutState {
  terminalWidthPercent: number
  chartHeightPercent: number
}

// ── Sprint 100: Cross-venue portfolio types ─────────────────────────────

export interface CrossVenueAssetEntry {
  asset: string
  valueUSD: number
}

export interface CrossVenueVenueEntry {
  venueId: string
  valueUSD: number
}

export interface CrossVenuePortfolio {
  totalUSD: number
  perVenue: CrossVenueVenueEntry[]
  perAsset: CrossVenueAssetEntry[]
  concentrationAlerts: string[]
  timestamp: number
}

export interface VenueHealthEntry {
  venueId: string
  vertical: string
  connected: boolean
  lastHealthCheck: number
  error?: string
}

export interface VenueStatus {
  venues: VenueHealthEntry[]
  connectedCount: number
  totalCount: number
  timestamp: number
}

// ── Sprint 102: Weekly Review & Risk Map types ──────────────────────────────

export interface WeeklyReviewVenue {
  venue: string
  tradeCount: number
  wins: number
  losses: number
  winRate: number
  avgRMultiple: number
  expectancy: number
  totalPnl: number
}

export interface WeeklyReviewTrend {
  vertical: string
  currentWinRate: number
  previousWinRate: number
  trend: 'improving' | 'regressing' | 'stable' | 'new'
}

export interface WeeklyReviewData {
  periodStart: string
  periodEnd: string
  masterName: string
  totalTrades: number
  overallWinRate: number
  overallExpectancy: number
  perVenue: WeeklyReviewVenue[]
  verticalTrends: WeeklyReviewTrend[]
  guardianCommentary: string
  timestamp: number
}

export interface RiskMapBubble {
  symbol: string
  venue: string
  notional: number
  liquidationDistance: number
  side: 'buy' | 'sell'
  unrealizedPnlPercent: number
}

export interface RiskMapData {
  bubbles: RiskMapBubble[]
  timestamp: number
}
