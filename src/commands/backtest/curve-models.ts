/**
 * curve-models.ts — Mathematical curve generators for backtest equity charts.
 *
 * Each "shape" produces a realistic equity curve from compact parameters,
 * so 68 guardian backtests don't require 68 × 55 hardcoded data points.
 *
 * All shapes return [rawCurve, guardianCurve] of length `points`.
 */

// ── Deterministic seeded RNG (mulberry32) ──────────────────────────

function rng(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function noise(rand: () => number, amplitude: number): number {
  return (rand() - 0.5) * 2 * amplitude
}

// ── Interpolation helper ───────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

// ── Curve Shapes ───────────────────────────────────────────────────

export type CurveShape =
  | 'moonshot_crash'     // explosive up → crash to 0 (Liangxi, Newton)
  | 'big_short'          // flat/bleeding → massive spike (Soros, Burry, Paulson)
  | 'steady_compound'    // smooth upward, minor dips (Buffett, Graham, Simons)
  | 'trend_follow'       // staircase up with drawdowns (Livermore, Dennis, Darvas)
  | 'quant_smooth'       // very smooth, low vol (Simons, Thorp, Shannon)
  | 'volatility_ride'    // wild swings, net positive (Druckenmiller, Hayes)
  | 'patient_strike'     // long flat → sudden decisive gain (Musashi, Sun Tzu)
  | 'hold_through'       // deep drawdown → recovery (Munger, Dalio, Saylor)
  | 'catastrophic'       // up then total collapse (Do Kwon, SBF, 3AC)
  | 'wu_wei'             // barely trades, avoids crash (Laozi, Seneca)
  | 'innovation_curve'   // exponential believers (Cathie Wood, Musk)
  | 'macro_squeeze'      // pressure builds → one explosive move (Powell, Yellen)

export interface CurveParams {
  shape: CurveShape
  seed: number            // deterministic RNG seed
  peakMult: number        // peak return multiplier (e.g. 985 = 985x)
  finalRaw: number        // raw final as fraction of initial (0 = liquidated)
  guardianPeak: number    // guardian peak multiplier
  guardianFinal: number   // guardian final multiplier
  volatility: number      // 0-1 noise amplitude
  peakPos: number         // 0-1 where peak occurs in timeline
  initial?: number        // starting capital (default 1000)
  points?: number         // data points (default 50)
}

export interface CurveResult {
  raw: number[]
  guardian: number[]
}

export function generateCurves(p: CurveParams): CurveResult {
  const n = p.points ?? 50
  const init = p.initial ?? 1000
  const rand = rng(p.seed)

  switch (p.shape) {
    case 'moonshot_crash': return moonshotCrash(n, init, p, rand)
    case 'big_short': return bigShort(n, init, p, rand)
    case 'steady_compound': return steadyCompound(n, init, p, rand)
    case 'trend_follow': return trendFollow(n, init, p, rand)
    case 'quant_smooth': return quantSmooth(n, init, p, rand)
    case 'volatility_ride': return volatilityRide(n, init, p, rand)
    case 'patient_strike': return patientStrike(n, init, p, rand)
    case 'hold_through': return holdThrough(n, init, p, rand)
    case 'catastrophic': return catastrophic(n, init, p, rand)
    case 'wu_wei': return wuWei(n, init, p, rand)
    case 'innovation_curve': return innovationCurve(n, init, p, rand)
    case 'macro_squeeze': return macroSqueeze(n, init, p, rand)
    default: return steadyCompound(n, init, p, rand)
  }
}

// ── Shape implementations ──────────────────────────────────────────

/** Explosive growth to peak, then sudden crash. Guardian caps the peak but survives. */
function moonshotCrash(n: number, init: number, p: CurveParams, rand: () => number): CurveResult {
  const raw: number[] = []
  const grd: number[] = []
  const peakIdx = Math.floor(p.peakPos * n)

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const v = p.volatility

    if (i <= peakIdx) {
      // Exponential rise to peak
      const progress = i / peakIdx
      const exp = Math.pow(p.peakMult, smoothstep(progress))
      raw.push(Math.max(init * exp * (1 + noise(rand, v * 0.1)), init * 0.5))

      const gExp = Math.pow(p.guardianPeak, smoothstep(progress))
      grd.push(Math.max(init * gExp * (1 + noise(rand, v * 0.05)), init * 0.8))
    } else {
      // Crash phase — raw goes to 0, guardian holds
      const crashProgress = (i - peakIdx) / (n - peakIdx - 1)
      const crashT = smoothstep(crashProgress)

      const rawVal = lerp(init * p.peakMult, init * p.finalRaw, crashT)
      raw.push(Math.max(rawVal * (1 + noise(rand, v * 0.15)), 0))

      const grdTarget = init * p.guardianFinal
      const grdFrom = init * p.guardianPeak
      grd.push(Math.max(lerp(grdFrom, grdTarget, crashT * 0.6) * (1 + noise(rand, v * 0.03)), init * 0.5))
    }
  }
  return { raw, guardian: grd }
}

/** Flat or slightly losing, then massive spike when thesis pays off. */
function bigShort(n: number, init: number, p: CurveParams, rand: () => number): CurveResult {
  const raw: number[] = []
  const grd: number[] = []
  const triggerIdx = Math.floor(p.peakPos * n)

  for (let i = 0; i < n; i++) {
    const v = p.volatility

    if (i <= triggerIdx) {
      // Bleeding phase — slightly losing money (carry cost of shorts)
      const bleed = 1 - (i / triggerIdx) * 0.3
      raw.push(init * bleed * (1 + noise(rand, v * 0.05)))
      grd.push(init * bleed * (1 + noise(rand, v * 0.03)))
    } else {
      // Payoff — rapid spike then plateau
      const payProgress = (i - triggerIdx) / (n - triggerIdx - 1)
      const spike = smoothstep(Math.min(payProgress * 2, 1))

      const rawVal = lerp(init * 0.7, init * p.peakMult, spike)
      raw.push(rawVal * (1 + noise(rand, v * 0.05)))

      const grdVal = lerp(init * 0.7, init * p.guardianPeak, spike)
      grd.push(grdVal * (1 + noise(rand, v * 0.03)))
    }
  }
  // Tail — hold position
  const rawFinal = raw[raw.length - 1]!
  const grdFinal = grd[grd.length - 1]!
  for (let i = raw.length - 3; i < raw.length; i++) {
    raw[i] = rawFinal * (1 + noise(rand, p.volatility * 0.02))
    grd[i] = grdFinal * (1 + noise(rand, p.volatility * 0.01))
  }
  return { raw, guardian: grd }
}

/** Smooth compounding with minor dips. Guardian nearly identical. */
function steadyCompound(n: number, init: number, p: CurveParams, rand: () => number): CurveResult {
  const raw: number[] = []
  const grd: number[] = []
  const rate = Math.pow(p.peakMult, 1 / n)
  const gRate = Math.pow(p.guardianPeak, 1 / n)

  let rawVal = init, grdVal = init
  for (let i = 0; i < n; i++) {
    rawVal *= rate * (1 + noise(rand, p.volatility * 0.08))
    grdVal *= gRate * (1 + noise(rand, p.volatility * 0.05))
    raw.push(Math.max(rawVal, init * 0.3))
    grd.push(Math.max(grdVal, init * 0.5))
  }
  return { raw, guardian: grd }
}

/** Staircase up with periodic drawdowns. */
function trendFollow(n: number, init: number, p: CurveParams, rand: () => number): CurveResult {
  const raw: number[] = []
  const grd: number[] = []
  const steps = 4 + Math.floor(rand() * 3) // 4-6 trend legs

  let rawVal = init, grdVal = init
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const phase = (t * steps) % 1 // position within current step

    if (phase < 0.6) {
      // Trending up
      const stepGain = Math.pow(p.peakMult, 1 / steps)
      rawVal *= 1 + (stepGain - 1) / (0.6 * (n / steps)) * (1 + noise(rand, p.volatility * 0.15))
      grdVal *= 1 + (Math.pow(p.guardianPeak, 1 / steps) - 1) / (0.6 * (n / steps)) * (1 + noise(rand, p.volatility * 0.08))
    } else {
      // Drawdown
      rawVal *= 1 - 0.03 * (1 + noise(rand, p.volatility))
      grdVal *= 1 - 0.015 * (1 + noise(rand, p.volatility * 0.5))
    }
    raw.push(Math.max(rawVal, init * 0.1))
    grd.push(Math.max(grdVal, init * 0.3))
  }
  // Apply final multiplier adjustment
  const rawScale = (init * p.finalRaw || raw[raw.length - 1]!) / raw[raw.length - 1]!
  const grdScale = (init * p.guardianFinal) / grd[grd.length - 1]!
  return {
    raw: raw.map(v => v * lerp(1, rawScale, 0.5)),
    guardian: grd.map(v => v * lerp(1, grdScale, 0.5)),
  }
}

/** Very smooth upward curve, almost no volatility. */
function quantSmooth(n: number, init: number, p: CurveParams, rand: () => number): CurveResult {
  const raw: number[] = []
  const grd: number[] = []
  const rate = Math.pow(p.peakMult, 1 / n)
  const gRate = Math.pow(p.guardianPeak, 1 / n)

  let rawVal = init, grdVal = init
  for (let i = 0; i < n; i++) {
    rawVal *= rate * (1 + noise(rand, p.volatility * 0.02))
    grdVal *= gRate * (1 + noise(rand, p.volatility * 0.015))
    raw.push(rawVal)
    grd.push(grdVal)
  }
  return { raw, guardian: grd }
}

/** Wild swings but net positive trajectory. */
function volatilityRide(n: number, init: number, p: CurveParams, rand: () => number): CurveResult {
  const raw: number[] = []
  const grd: number[] = []
  const trend = Math.pow(p.peakMult, 1 / n)
  const gTrend = Math.pow(p.guardianPeak, 1 / n)

  let rawVal = init, grdVal = init
  for (let i = 0; i < n; i++) {
    const swing = noise(rand, p.volatility * 0.25)
    rawVal *= trend * (1 + swing)
    grdVal *= gTrend * (1 + swing * 0.5) // dampened swings
    raw.push(Math.max(rawVal, init * 0.05))
    grd.push(Math.max(grdVal, init * 0.2))
  }
  return { raw, guardian: grd }
}

/** Long flat period then sudden decisive gain. */
function patientStrike(n: number, init: number, p: CurveParams, rand: () => number): CurveResult {
  const raw: number[] = []
  const grd: number[] = []
  const strikeIdx = Math.floor(p.peakPos * n)

  for (let i = 0; i < n; i++) {
    if (i < strikeIdx) {
      // Patient waiting — minimal change
      const drift = 1 + (i / strikeIdx) * 0.1 + noise(rand, p.volatility * 0.03)
      raw.push(init * drift)
      grd.push(init * drift)
    } else {
      // Strike — rapid gain then hold
      const progress = (i - strikeIdx) / (n - strikeIdx - 1)
      const strike = smoothstep(Math.min(progress * 1.5, 1))
      raw.push(lerp(init * 1.1, init * p.peakMult, strike) * (1 + noise(rand, p.volatility * 0.04)))
      grd.push(lerp(init * 1.1, init * p.guardianPeak, strike) * (1 + noise(rand, p.volatility * 0.03)))
    }
  }
  return { raw, guardian: grd }
}

/** Deep drawdown then recovery. Guardian has shallower drawdown. */
function holdThrough(n: number, init: number, p: CurveParams, rand: () => number): CurveResult {
  const raw: number[] = []
  const grd: number[] = []
  const dipIdx = Math.floor(p.peakPos * n)
  const dipDepth = 1 / p.peakMult // inverse of peak = how deep it falls

  for (let i = 0; i < n; i++) {
    const v = p.volatility
    if (i <= dipIdx) {
      // Rising to pre-crash level
      const rise = smoothstep(i / dipIdx)
      raw.push(lerp(init, init * 2.5, rise) * (1 + noise(rand, v * 0.08)))
      grd.push(lerp(init, init * 2, rise) * (1 + noise(rand, v * 0.05)))
    } else if (i <= dipIdx + (n - dipIdx) * 0.4) {
      // Crash
      const crashLen = (n - dipIdx) * 0.4
      const progress = (i - dipIdx) / crashLen
      const crashT = smoothstep(progress)
      raw.push(lerp(init * 2.5, init * dipDepth, crashT) * (1 + noise(rand, v * 0.1)))
      grd.push(lerp(init * 2, init * dipDepth * 2, crashT) * (1 + noise(rand, v * 0.06)))
    } else {
      // Recovery
      const recoveryStart = dipIdx + (n - dipIdx) * 0.4
      const progress = (i - recoveryStart) / (n - recoveryStart - 1)
      const recoverT = smoothstep(progress)
      raw.push(lerp(init * dipDepth, init * p.finalRaw, recoverT) * (1 + noise(rand, v * 0.06)))
      grd.push(lerp(init * dipDepth * 2, init * p.guardianFinal, recoverT) * (1 + noise(rand, v * 0.04)))
    }
  }
  return { raw, guardian: grd }
}

/** Rise then total collapse. Guardian saves most capital. */
function catastrophic(n: number, init: number, p: CurveParams, rand: () => number): CurveResult {
  const raw: number[] = []
  const grd: number[] = []
  const peakIdx = Math.floor(p.peakPos * n)

  for (let i = 0; i < n; i++) {
    const v = p.volatility
    if (i <= peakIdx) {
      const rise = smoothstep(i / peakIdx)
      raw.push(lerp(init, init * p.peakMult, rise) * (1 + noise(rand, v * 0.08)))
      grd.push(lerp(init, init * p.guardianPeak, rise) * (1 + noise(rand, v * 0.05)))
    } else {
      // Catastrophic collapse — raw goes near 0, guardian exits early
      const crashProgress = (i - peakIdx) / (n - peakIdx - 1)
      const crashT = smoothstep(crashProgress)

      // Raw: parabolic crash (not linear)
      const rawCrash = Math.pow(1 - crashT, 0.3) // fast initial drop
      raw.push(Math.max(init * p.peakMult * rawCrash * p.finalRaw * (1 + noise(rand, v * 0.1)), init * 0.01))

      // Guardian: exits early, holds capital
      const grdExit = Math.max(1 - crashT * 0.3, p.guardianFinal / p.guardianPeak)
      grd.push(init * p.guardianPeak * grdExit * (1 + noise(rand, v * 0.02)))
    }
  }
  return { raw, guardian: grd }
}

/** Minimal trading — avoids crash by not being in the market. */
function wuWei(n: number, init: number, p: CurveParams, rand: () => number): CurveResult {
  const raw: number[] = [] // "active trader" who catches the crash
  const grd: number[] = [] // wu wei — mostly cash, small positions

  const crashIdx = Math.floor(p.peakPos * n)

  for (let i = 0; i < n; i++) {
    const v = p.volatility
    if (i <= crashIdx) {
      // Pre-crash: active trader is in the market, doing ok
      const rise = 1 + (i / crashIdx) * (p.peakMult - 1)
      raw.push(init * rise * (1 + noise(rand, v * 0.06)))
      // Wu wei: tiny drift, mostly cash
      grd.push(init * (1 + i / n * 0.15) * (1 + noise(rand, v * 0.01)))
    } else {
      // Crash: active trader loses, wu wei is untouched
      const progress = (i - crashIdx) / (n - crashIdx - 1)
      const crashT = smoothstep(progress)
      raw.push(lerp(init * p.peakMult, init * p.finalRaw, crashT) * (1 + noise(rand, v * 0.08)))
      // Wu wei: still steady
      grd.push(init * (1 + (p.guardianFinal - 1) * (i / n)) * (1 + noise(rand, v * 0.01)))
    }
  }
  return { raw, guardian: grd }
}

/** Exponential belief curve — parabolic then correction. */
function innovationCurve(n: number, init: number, p: CurveParams, rand: () => number): CurveResult {
  const raw: number[] = []
  const grd: number[] = []
  const peakIdx = Math.floor(p.peakPos * n)

  for (let i = 0; i < n; i++) {
    const v = p.volatility
    if (i <= peakIdx) {
      const t = i / peakIdx
      // S-curve acceleration
      const exp = Math.pow(p.peakMult, t * t)
      raw.push(init * exp * (1 + noise(rand, v * 0.1)))
      const gExp = Math.pow(p.guardianPeak, t * t * 0.8)
      grd.push(init * gExp * (1 + noise(rand, v * 0.05)))
    } else {
      // Correction but not death
      const progress = (i - peakIdx) / (n - peakIdx - 1)
      const corrT = smoothstep(progress)
      raw.push(lerp(init * p.peakMult, init * p.finalRaw, corrT) * (1 + noise(rand, v * 0.08)))
      grd.push(lerp(init * p.guardianPeak, init * p.guardianFinal, corrT) * (1 + noise(rand, v * 0.04)))
    }
  }
  return { raw, guardian: grd }
}

/** Pressure builds slowly, then one explosive macro move. */
function macroSqueeze(n: number, init: number, p: CurveParams, rand: () => number): CurveResult {
  const raw: number[] = []
  const grd: number[] = []
  const squeezeIdx = Math.floor(p.peakPos * n)

  for (let i = 0; i < n; i++) {
    const v = p.volatility
    if (i < squeezeIdx) {
      // Pressure building — slow grind
      const grind = 1 + (i / squeezeIdx) * 0.3 + noise(rand, v * 0.04)
      raw.push(init * grind)
      grd.push(init * grind * 0.95)
    } else if (i < squeezeIdx + (n - squeezeIdx) * 0.3) {
      // Squeeze fires — rapid move
      const fireLen = (n - squeezeIdx) * 0.3
      const progress = (i - squeezeIdx) / fireLen
      const spike = smoothstep(progress)
      raw.push(lerp(init * 1.3, init * p.peakMult, spike) * (1 + noise(rand, v * 0.06)))
      grd.push(lerp(init * 1.25, init * p.guardianPeak, spike) * (1 + noise(rand, v * 0.04)))
    } else {
      // Aftermath — settle
      const settleStart = squeezeIdx + (n - squeezeIdx) * 0.3
      const progress = (i - settleStart) / (n - settleStart - 1)
      raw.push(lerp(init * p.peakMult, init * p.finalRaw, progress * 0.3) * (1 + noise(rand, v * 0.05)))
      grd.push(lerp(init * p.guardianPeak, init * p.guardianFinal, progress * 0.2) * (1 + noise(rand, v * 0.03)))
    }
  }
  return { raw, guardian: grd }
}
