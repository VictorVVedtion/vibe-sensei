/**
 * strategies.ts — 68 guardian backtest registry.
 *
 * Each guardian is mapped to their signature historical event with
 * hand-curated curve parameters. Equity curves are generated at
 * render time via curve-models.ts, keeping this file compact.
 *
 * Format:  /backtest <guardian_key>
 * Example: /backtest jesse_livermore
 *          /backtest soros
 *          /backtest 凉兮
 */

import type { Master } from '../../buddy/types.js'
import { MASTER_NAMES, MASTER_QUOTES } from '../../buddy/types.js'
import { generateCurves, type CurveParams } from './curve-models.js'

// ── Types ──────────────────────────────────────────────────────────

export interface BacktestStrategy {
  event: string              // Historical event name
  subtitle: string           // Chart subtitle (instrument, date, capital, strategy)
  timeLabels: string[]       // X-axis time labels
  curve: CurveParams         // Curve generation parameters
  rawLabel: string           // Legend label for raw curve
  grdLabel: string           // Legend label for guardian curve
  raw:  { peak: number; final: number; mult: number; trades: number; wins: number; liqs: number }
  guardian: { peak: number; final: number; mult: number; trades: number; wins: number; liqs: number }
}

// ── Alias map (shortcuts → master keys) ────────────────────────────

export const STRATEGY_ALIASES: Record<string, Master> = {
  // Chinese name shortcuts
  '凉兮': 'liangxi',
  '孙子': 'sun_tzu',
  '范蠡': 'fan_li',
  '宫本武藏': 'miyamoto_musashi',
  '武藏': 'miyamoto_musashi',
  '吕不韦': 'lv_buwei',
  '老子': 'laozi',
  '李嘉诚': 'li_ka_shing',
  '胡雪岩': 'hu_xueyan',
  '宗庆后': 'zong_qinghou',
  '曾国藩': 'zeng_guofan',
  '白圭': 'bai_gui',
  '沈万三': 'shen_wansan',
  '张謇': 'zhang_jian',
  '赵长鹏': 'cz_zhao',
  '何一': 'he_yi',
  '徐明星': 'xu_mingxing',
  '孙宇晨': 'justin_sun',
  '本间宗久': 'munehisa_homma',
  // English shortcuts
  'livermore': 'jesse_livermore',
  'soros': 'george_soros',
  'ptj': 'paul_tudor_jones',
  'druck': 'stanley_druckenmiller',
  'druckenmiller': 'stanley_druckenmiller',
  'burry': 'michael_burry',
  'paulson': 'john_paulson',
  'darvas': 'nicolas_darvas',
  'buffett': 'warren_buffett',
  'graham': 'benjamin_graham',
  'munger': 'charlie_munger',
  'dalio': 'ray_dalio',
  'templeton': 'john_templeton',
  'simons': 'jim_simons',
  'thorp': 'ed_thorp',
  'dennis': 'richard_dennis',
  'raschke': 'linda_raschke',
  'homma': 'munehisa_homma',
  'musashi': 'miyamoto_musashi',
  'taleb': 'nassim_taleb',
  'satoshi': 'satoshi_nakamoto',
  'hayes': 'arthur_hayes',
  'oneil': 'william_oneil',
  'sperandeo': 'victor_sperandeo',
  'williams': 'larry_williams',
  'musk': 'elon_musk',
  'bezos': 'jeff_bezos',
  'thiel': 'peter_thiel',
  'jobs': 'steve_jobs',
  'feynman': 'richard_feynman',
  'tan': 'garry_tan',
  'karpathy': 'andrej_karpathy',
  'vitalik': 'vitalik_buterin',
  'buterin': 'vitalik_buterin',
  'cz': 'cz_zhao',
  'cronje': 'andre_cronje',
  'sun': 'justin_sun',
  'armstrong': 'brian_armstrong',
  'silbert': 'barry_silbert',
  'saylor': 'michael_saylor',
  'kwon': 'do_kwon',
  'luna': 'do_kwon',
  'sbf': 'sbf',
  'ftx': 'sbf',
  '3ac': 'su_zhu',
  'davies': 'kyle_davies',
  'wood': 'cathie_wood',
  'ark': 'cathie_wood',
  'newton': 'isaac_newton',
  'einstein': 'albert_einstein',
  'turing': 'alan_turing',
  'gauss': 'carl_gauss',
  'mandelbrot': 'benoit_mandelbrot',
  'shannon': 'claude_shannon',
  'von_neumann': 'john_von_neumann',
  'gensler': 'gary_gensler',
}

// ── Strategy Registry ──────────────────────────────────────────────

export const STRATEGIES: Partial<Record<Master, BacktestStrategy>> = {

  // ═══════════════════════════════════════════════════════════════════
  // WESTERN TRADING LEGENDS (7)
  // ═══════════════════════════════════════════════════════════════════

  jesse_livermore: {
    event: '1929 Stock Market Crash',
    subtitle: 'DJIA · Oct 24-Nov 13, 1929 · $1,000 · 10x SHORT · Momentum',
    timeLabels: ['Oct 24', 'Black Thu', 'Oct 28', 'Black Mon', 'Oct 29', 'Black Tue', 'Nov 1-5', 'Nov 13'],
    curve: { shape: 'trend_follow', seed: 1929, peakMult: 100, finalRaw: 80, guardianPeak: 60, guardianFinal: 55, volatility: 0.5, peakPos: 0.85 },
    rawLabel: 'Raw Livermore (无风控) — 100x peak, rode the crash',
    grdLabel: 'Livermore + Guardian — 60x, locked profits',
    raw:      { peak: 100000, final: 80000, mult: 100, trades: 24, wins: 18, liqs: 0 },
    guardian: { peak: 60000,  final: 55000, mult: 55,  trades: 35, wins: 22, liqs: 0 },
  },

  george_soros: {
    event: '1992 Black Wednesday — Breaking the Bank of England',
    subtitle: 'GBP/DEM · Sep 14-18, 1992 · $1,000 · 20x SHORT GBP · Macro',
    timeLabels: ['Sep 14', 'Sep 15', 'Pressure', 'Black Wed', 'GBP exits ERM', 'Sep 17', 'Sep 18', 'Aftermath'],
    curve: { shape: 'big_short', seed: 1992, peakMult: 200, finalRaw: 190, guardianPeak: 120, guardianFinal: 115, volatility: 0.3, peakPos: 0.45 },
    rawLabel: 'Raw Soros (无风控) — $10B short, £1B profit',
    grdLabel: 'Soros + Guardian — sized down, still massive',
    raw:      { peak: 200000, final: 190000, mult: 200, trades: 5,  wins: 4, liqs: 0 },
    guardian: { peak: 120000, final: 115000, mult: 115, trades: 8,  wins: 6, liqs: 0 },
  },

  paul_tudor_jones: {
    event: '1987 Black Monday',
    subtitle: 'S&P 500 Futures · Oct 12-23, 1987 · $1,000 · 5x SHORT · Defense First',
    timeLabels: ['Oct 12', 'Oct 14', 'Oct 16', 'Fri close', 'BLACK MON', 'Oct 20', 'Oct 21', 'Oct 23'],
    curve: { shape: 'big_short', seed: 1987, peakMult: 62, finalRaw: 55, guardianPeak: 40, guardianFinal: 38, volatility: 0.4, peakPos: 0.55 },
    rawLabel: 'Raw PTJ (无风控) — 62x, called the crash',
    grdLabel: 'PTJ + Guardian — 40x, defense first',
    raw:      { peak: 62000,  final: 55000, mult: 62,  trades: 12, wins: 9, liqs: 0 },
    guardian: { peak: 40000,  final: 38000, mult: 38,  trades: 18, wins: 12, liqs: 0 },
  },

  stanley_druckenmiller: {
    event: '1992 British Pound + 1999 Tech Bubble',
    subtitle: 'GBP/USD + NASDAQ · 1992-2000 · $1,000 · Concentrated Bets',
    timeLabels: ['1992 GBP', 'Pound falls', '1995', '1997', '1999 Tech', 'Dot-com peak', '2000 Crash', 'Exit'],
    curve: { shape: 'volatility_ride', seed: 199200, peakMult: 120, finalRaw: 30, guardianPeak: 60, guardianFinal: 55, volatility: 0.6, peakPos: 0.7 },
    rawLabel: 'Raw Druck (无风控) — 120x peak then FOMO into tech',
    grdLabel: 'Druck + Guardian — 60x, avoided tech FOMO',
    raw:      { peak: 120000, final: 30000,  mult: 30,  trades: 40, wins: 28, liqs: 0 },
    guardian: { peak: 60000,  final: 55000,  mult: 55,  trades: 50, wins: 32, liqs: 0 },
  },

  michael_burry: {
    event: '2007-2008 Subprime Crisis — The Big Short',
    subtitle: 'CDS vs MBS · 2005-2008 · $1,000 · Contrarian Deep Value',
    timeLabels: ['2005 Buy CDS', '2006 Bleed', 'Carry cost', '2007 Cracks', 'Bear Stearns', 'Sep 2008', 'Lehman', 'Payoff'],
    curve: { shape: 'big_short', seed: 2008, peakMult: 489, finalRaw: 470, guardianPeak: 200, guardianFinal: 195, volatility: 0.35, peakPos: 0.7 },
    rawLabel: 'Raw Burry (无风控) — 489% return, 2 years of pain',
    grdLabel: 'Burry + Guardian — 200%, smaller bet size',
    raw:      { peak: 489000, final: 470000, mult: 489, trades: 8,  wins: 6, liqs: 0 },
    guardian: { peak: 200000, final: 195000, mult: 195, trades: 12, wins: 8, liqs: 0 },
  },

  john_paulson: {
    event: '2007 Greatest Trade Ever — Shorting Subprime',
    subtitle: 'CDS vs ABX Index · 2006-2008 · $1,000 · Asymmetric Bet',
    timeLabels: ['2006 Thesis', 'Buy CDS', 'Bleeding', 'Patience', 'Cracks', 'Bear Falls', 'Lehman', 'Payday $15B'],
    curve: { shape: 'big_short', seed: 2007, peakMult: 590, finalRaw: 580, guardianPeak: 250, guardianFinal: 240, volatility: 0.3, peakPos: 0.75 },
    rawLabel: 'Raw Paulson (无风控) — 590x, greatest trade ever',
    grdLabel: 'Paulson + Guardian — 250x, position-sized',
    raw:      { peak: 590000, final: 580000, mult: 590, trades: 6,  wins: 5, liqs: 0 },
    guardian: { peak: 250000, final: 240000, mult: 240, trades: 10, wins: 7, liqs: 0 },
  },

  nicolas_darvas: {
    event: '1957-58 Bull Run — Box Breakout System',
    subtitle: 'NYSE · 1957-1958 · $1,000 · Box Breakout · $36K from mail',
    timeLabels: ['1957 Start', 'First box', 'Breakout', 'New high', 'Stack', 'Pyramid', '1958 Peak', 'Exit'],
    curve: { shape: 'trend_follow', seed: 1957, peakMult: 36, finalRaw: 33, guardianPeak: 25, guardianFinal: 24, volatility: 0.35, peakPos: 0.85 },
    rawLabel: 'Raw Darvas (无风控) — 36x, trading by telegram',
    grdLabel: 'Darvas + Guardian — 25x, tighter stops',
    raw:      { peak: 36000,  final: 33000,  mult: 33,  trades: 45, wins: 28, liqs: 0 },
    guardian: { peak: 25000,  final: 24000,  mult: 24,  trades: 55, wins: 32, liqs: 0 },
  },

  // ═══════════════════════════════════════════════════════════════════
  // VALUE INVESTING SAGES (5)
  // ═══════════════════════════════════════════════════════════════════

  warren_buffett: {
    event: '2008 Financial Crisis — "Be Greedy When Others Are Fearful"',
    subtitle: 'Goldman + BofA + BRK-A · Sep 2008-Mar 2009 · $1,000 · Value',
    timeLabels: ['Sep 2008', 'Lehman', 'GS Deal', 'Oct Panic', 'Nov Low', 'BofA Deal', 'Mar 2009', 'Recovery'],
    curve: { shape: 'hold_through', seed: 200801, peakMult: 3.5, finalRaw: 4.2, guardianPeak: 3.2, guardianFinal: 3.8, volatility: 0.3, peakPos: 0.3 },
    rawLabel: 'Raw Buffett — bought the fear, 4.2x in 18 months',
    grdLabel: 'Buffett + Guardian — similar, already conservative',
    raw:      { peak: 4200,  final: 4200,  mult: 4,  trades: 5,  wins: 5,  liqs: 0 },
    guardian: { peak: 3800,  final: 3800,  mult: 4,  trades: 5,  wins: 5,  liqs: 0 },
  },

  benjamin_graham: {
    event: '1929 Crash Survival + Recovery',
    subtitle: 'US Equities · 1929-1932 · $1,000 · Margin of Safety',
    timeLabels: ['1929 Peak', 'Black Thu', 'Crash', '1930', '1931 Bleed', '1932 Bottom', 'Slow recovery', '1935'],
    curve: { shape: 'hold_through', seed: 192901, peakMult: 4, finalRaw: 2.5, guardianPeak: 3, guardianFinal: 2.8, volatility: 0.4, peakPos: 0.15 },
    rawLabel: 'Raw Graham — lost 70%, rebuilt with discipline',
    grdLabel: 'Graham + Guardian — margin of safety limited loss',
    raw:      { peak: 2500,  final: 2500,  mult: 3, trades: 15, wins: 10, liqs: 0 },
    guardian: { peak: 2800,  final: 2800,  mult: 3, trades: 12, wins: 9,  liqs: 0 },
  },

  charlie_munger: {
    event: '1973-74 Bear Market — Lost 53%, Held, Won',
    subtitle: 'Wheeler Munger Partnership · 1973-1975 · $1,000 · Inversion',
    timeLabels: ['1973 Start', 'Oil shock', 'Watergate', 'Bottom -53%', '1974 Hold', 'Recovery', '1975', 'Vindicated'],
    curve: { shape: 'hold_through', seed: 1973, peakMult: 2, finalRaw: 3.5, guardianPeak: 1.8, guardianFinal: 3.2, volatility: 0.4, peakPos: 0.2 },
    rawLabel: 'Raw Munger — -53% drawdown, iron hands',
    grdLabel: 'Munger + Guardian — shallower drawdown',
    raw:      { peak: 3500,  final: 3500,  mult: 4,  trades: 8,  wins: 6,  liqs: 0 },
    guardian: { peak: 3200,  final: 3200,  mult: 3,  trades: 8,  wins: 6,  liqs: 0 },
  },

  ray_dalio: {
    event: '2020 COVID Crash — All Weather Portfolio',
    subtitle: 'All Weather · Feb-Dec 2020 · $1,000 · Systematic/Principles',
    timeLabels: ['Feb 2020', 'COVID hits', 'Mar crash', 'Bottom', 'Fed pivot', 'Recovery', 'Q3 2020', 'Dec 2020'],
    curve: { shape: 'hold_through', seed: 2020, peakMult: 1.5, finalRaw: 1.8, guardianPeak: 1.4, guardianFinal: 1.7, volatility: 0.25, peakPos: 0.2 },
    rawLabel: 'Raw All Weather — -20% drawdown, systematic rebalance',
    grdLabel: 'Dalio + Guardian — dampened, principles-based',
    raw:      { peak: 1800,  final: 1800,  mult: 2, trades: 12, wins: 8,  liqs: 0 },
    guardian: { peak: 1700,  final: 1700,  mult: 2, trades: 10, wins: 7,  liqs: 0 },
  },

  john_templeton: {
    event: '1939 WWII Bargains — Bought 104 Stocks Under $1',
    subtitle: 'NYSE Sub-$1 Basket · 1939-1945 · $1,000 · Contrarian',
    timeLabels: ['1939 War', 'Buy basket', '1940', '1941 Pearl', '1942', '1943 Turn', '1944 D-Day', '1945 V-E'],
    curve: { shape: 'patient_strike', seed: 1939, peakMult: 40, finalRaw: 38, guardianPeak: 28, guardianFinal: 27, volatility: 0.25, peakPos: 0.35 },
    rawLabel: 'Raw Templeton — 40x on wartime bargains',
    grdLabel: 'Templeton + Guardian — 28x, diversified basket',
    raw:      { peak: 40000,  final: 38000,  mult: 38,  trades: 104, wins: 100, liqs: 0 },
    guardian: { peak: 28000,  final: 27000,  mult: 27,  trades: 104, wins: 100, liqs: 0 },
  },

  // ═══════════════════════════════════════════════════════════════════
  // QUANT/SYSTEMATIC PIONEERS (4)
  // ═══════════════════════════════════════════════════════════════════

  jim_simons: {
    event: '1988-2018 Medallion Fund — 66% Avg Annual',
    subtitle: 'Medallion Fund · 30 Years · $1,000 · Pure Math · 66% CAGR',
    timeLabels: ['1988', '1993', '1998 LTCM', '2003', '2008 Crisis', '2013', '2018', '30 Years'],
    curve: { shape: 'quant_smooth', seed: 1988, peakMult: 850, finalRaw: 820, guardianPeak: 600, guardianFinal: 590, volatility: 0.15, peakPos: 0.95 },
    rawLabel: 'Raw Medallion — 850x, best track record in history',
    grdLabel: 'Simons + Guardian — 600x, already has risk controls',
    raw:      { peak: 850000, final: 820000, mult: 820, trades: 5000, wins: 3900, liqs: 0 },
    guardian: { peak: 600000, final: 590000, mult: 590, trades: 5000, wins: 3900, liqs: 0 },
  },

  ed_thorp: {
    event: '1970s Princeton Newport — Kelly Criterion',
    subtitle: 'Options Arb · 1969-1988 · $1,000 · Kelly Criterion · 20% CAGR',
    timeLabels: ['1969', '1972', '1974 Bear', '1977', '1980', '1983', '1986', '1988'],
    curve: { shape: 'quant_smooth', seed: 1969, peakMult: 30, finalRaw: 28, guardianPeak: 25, guardianFinal: 24, volatility: 0.1, peakPos: 0.95 },
    rawLabel: 'Raw Thorp — 30x, Kelly-optimal sizing',
    grdLabel: 'Thorp + Guardian — 25x, fractional Kelly',
    raw:      { peak: 30000,  final: 28000,  mult: 28,  trades: 2000, wins: 1300, liqs: 0 },
    guardian: { peak: 25000,  final: 24000,  mult: 24,  trades: 2000, wins: 1300, liqs: 0 },
  },

  richard_dennis: {
    event: '1983 Turtle Trading — $400 to $200M in Soybeans',
    subtitle: 'Soybeans + Bonds · 1983-1988 · $1,000 · Turtle Breakout',
    timeLabels: ['1983 Start', 'First trade', 'Soybeans', 'Trend runs', 'Pyramid', '1986', 'Peak', '1987 Crash'],
    curve: { shape: 'trend_follow', seed: 1983, peakMult: 150, finalRaw: 80, guardianPeak: 90, guardianFinal: 85, volatility: 0.45, peakPos: 0.75 },
    rawLabel: 'Raw Dennis — 150x peak, gave back in \'87 crash',
    grdLabel: 'Dennis + Guardian — 90x, tighter turtle rules',
    raw:      { peak: 150000, final: 80000,  mult: 80,  trades: 120, wins: 48, liqs: 0 },
    guardian: { peak: 90000,  final: 85000,  mult: 85,  trades: 150, wins: 55, liqs: 0 },
  },

  linda_raschke: {
    event: '1987 Black Monday — Pattern Reversal',
    subtitle: 'S&P 500 Futures · Oct 19-23, 1987 · $1,000 · Pattern Trading',
    timeLabels: ['Oct 16', 'Fri close', 'BLACK MON', 'Panic low', 'Reversal', 'Pattern fires', 'Oct 21', 'Oct 23'],
    curve: { shape: 'volatility_ride', seed: 198701, peakMult: 15, finalRaw: 12, guardianPeak: 10, guardianFinal: 9.5, volatility: 0.5, peakPos: 0.9 },
    rawLabel: 'Raw Raschke — 15x, rode the reversal pattern',
    grdLabel: 'Raschke + Guardian — 10x, tighter risk per trade',
    raw:      { peak: 15000,  final: 12000,  mult: 12,  trades: 30, wins: 18, liqs: 0 },
    guardian: { peak: 10000,  final: 9500,   mult: 10,  trades: 35, wins: 20, liqs: 0 },
  },

  // ═══════════════════════════════════════════════════════════════════
  // EASTERN STRATEGISTS (5)
  // ═══════════════════════════════════════════════════════════════════

  sun_tzu: {
    event: 'Battle of Red Cliffs Applied — Strategic Positioning in BTC',
    subtitle: 'BTC/USDT · Consolidation Breakout · $1,000 · Strategic Patience',
    timeLabels: ['Scout', 'Terrain', 'Wait', 'False move', 'Enemy commits', 'STRIKE', 'Pursue', 'Victory'],
    curve: { shape: 'patient_strike', seed: 500, peakMult: 25, finalRaw: 24, guardianPeak: 20, guardianFinal: 19.5, volatility: 0.2, peakPos: 0.6 },
    rawLabel: 'Raw Sun Tzu — waited, struck once, 25x',
    grdLabel: 'Sun Tzu + Guardian — 20x, calculated risk',
    raw:      { peak: 25000,  final: 24000,  mult: 24,  trades: 3,  wins: 3,  liqs: 0 },
    guardian: { peak: 20000,  final: 19500,  mult: 20,  trades: 5,  wins: 4,  liqs: 0 },
  },

  munehisa_homma: {
    event: '1750s Dojima Rice Exchange — Candlestick Origin',
    subtitle: 'Rice Futures · Dojima, Osaka · 1755 · $1,000 · Candlestick Reading',
    timeLabels: ['Spring', 'Plant', 'Read market', 'Drought fear', 'Panic buy', 'Harvest', 'Sell peak', 'Winter'],
    curve: { shape: 'trend_follow', seed: 1755, peakMult: 100, finalRaw: 95, guardianPeak: 65, guardianFinal: 62, volatility: 0.3, peakPos: 0.8 },
    rawLabel: 'Raw Homma — 100x, father of candlesticks',
    grdLabel: 'Homma + Guardian — 65x, modern risk overlay',
    raw:      { peak: 100000, final: 95000,  mult: 95,  trades: 50, wins: 42, liqs: 0 },
    guardian: { peak: 65000,  final: 62000,  mult: 62,  trades: 55, wins: 40, liqs: 0 },
  },

  fan_li: {
    event: 'Spring & Autumn Period — Counter-Cyclical Trade Empire',
    subtitle: 'Silk + Grain · 473-450 BC · $1,000 · 人弃我取 · Counter-cyclical',
    timeLabels: ['Famine buy', 'Store', 'Wait', 'Glut sell', 'War demand', 'Cycle 2', 'Cycle 3', 'Retire'],
    curve: { shape: 'steady_compound', seed: 473, peakMult: 80, finalRaw: 78, guardianPeak: 55, guardianFinal: 53, volatility: 0.25, peakPos: 0.9 },
    rawLabel: 'Raw Fan Li — 80x, three fortunes made and given away',
    grdLabel: 'Fan Li + Guardian — 55x, diversified across goods',
    raw:      { peak: 80000,  final: 78000,  mult: 78,  trades: 30, wins: 25, liqs: 0 },
    guardian: { peak: 55000,  final: 53000,  mult: 53,  trades: 30, wins: 24, liqs: 0 },
  },

  miyamoto_musashi: {
    event: 'Ganryujima Duel — One Strike Philosophy in BTC',
    subtitle: 'BTC/USDT 1D · Consolidation → Breakout · $1,000 · 不做无用之事',
    timeLabels: ['Observe', 'Wait', 'Study', 'Enemy restless', 'Hesitate', 'STRIKE', 'One cut', 'Walk away'],
    curve: { shape: 'patient_strike', seed: 1612, peakMult: 18, finalRaw: 17.5, guardianPeak: 15, guardianFinal: 14.8, volatility: 0.15, peakPos: 0.7 },
    rawLabel: 'Raw Musashi — 18x, one perfect trade',
    grdLabel: 'Musashi + Guardian — 15x, sized for survival',
    raw:      { peak: 18000,  final: 17500,  mult: 18,  trades: 1, wins: 1, liqs: 0 },
    guardian: { peak: 15000,  final: 14800,  mult: 15,  trades: 1, wins: 1, liqs: 0 },
  },

  lv_buwei: {
    event: 'Investing in a Prince — Ultimate Leverage Play',
    subtitle: 'Political Futures · Qin Dynasty · $1,000 · 奇货可居 · Asymmetric',
    timeLabels: ['Scout', 'Find prince', 'Invest', 'Cultivate', 'Wait', 'Prince rises', 'King!', 'Chancellor'],
    curve: { shape: 'patient_strike', seed: 249, peakMult: 500, finalRaw: 480, guardianPeak: 200, guardianFinal: 195, volatility: 0.2, peakPos: 0.7 },
    rawLabel: 'Raw Lv Buwei — 500x, bet on a person not a price',
    grdLabel: 'Lv Buwei + Guardian — 200x, diversified bets',
    raw:      { peak: 500000, final: 480000, mult: 480, trades: 1, wins: 1, liqs: 0 },
    guardian: { peak: 200000, final: 195000, mult: 195, trades: 3, wins: 2, liqs: 0 },
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHILOSOPHERS OF RISK (4)
  // ═══════════════════════════════════════════════════════════════════

  nassim_taleb: {
    event: '2020 Universa COVID Black Swan — 4,144% Return',
    subtitle: 'S&P 500 Puts · Jan-Mar 2020 · $1,000 · Antifragile/Tail Hedge',
    timeLabels: ['Jan 2020', 'Small bleed', 'Feb quiet', 'COVID spreads', 'Mar crash', 'VIX 82', 'Payoff', 'Aftermath'],
    curve: { shape: 'big_short', seed: 202001, peakMult: 42, finalRaw: 40, guardianPeak: 30, guardianFinal: 29, volatility: 0.3, peakPos: 0.6 },
    rawLabel: 'Raw Universa — 4,144%, tail hedge pays off',
    grdLabel: 'Taleb + Guardian — 30x, antifragile by design',
    raw:      { peak: 42000,  final: 40000,  mult: 40,  trades: 12, wins: 3,  liqs: 0 },
    guardian: { peak: 30000,  final: 29000,  mult: 29,  trades: 15, wins: 4,  liqs: 0 },
  },

  seneca: {
    event: 'Stoic Portfolio — BTC 2022 Bear Market',
    subtitle: 'BTC/USDT · Nov 2021-Dec 2022 · $1,000 · Stoic Endurance',
    timeLabels: ['ATH $69K', 'LUNA crash', 'Bear begins', '3AC falls', 'FTX fear', 'FTX dies', 'Capitulation', 'Survive'],
    curve: { shape: 'wu_wei', seed: 202201, peakMult: 1.8, finalRaw: 0.4, guardianPeak: 1.3, guardianFinal: 1.15, volatility: 0.2, peakPos: 0.15 },
    rawLabel: 'Active Trader — caught every crash, -60%',
    grdLabel: 'Seneca (Stoic) — mostly cash, +15% in bear',
    raw:      { peak: 1800,  final: 400,   mult: 0, trades: 45, wins: 15, liqs: 2 },
    guardian: { peak: 1300,  final: 1150,  mult: 1, trades: 5,  wins: 3,  liqs: 0 },
  },

  laozi: {
    event: 'Wu Wei — 2022 Crypto Winter (Not Trading)',
    subtitle: 'BTC/USDT · Nov 2021-Jan 2023 · $1,000 · 上善若水 · Wu Wei',
    timeLabels: ['ATH Nov', 'LUNA May', 'Summer', '3AC Jun', 'Quiet', 'FTX Nov', 'Bottom', 'Spring 2023'],
    curve: { shape: 'wu_wei', seed: 202202, peakMult: 2.2, finalRaw: 0.3, guardianPeak: 1.1, guardianFinal: 1.08, volatility: 0.15, peakPos: 0.1 },
    rawLabel: 'Active Trader — FOMO + panic, -70%',
    grdLabel: 'Laozi (Wu Wei) — did nothing, preserved capital',
    raw:      { peak: 2200,  final: 300,   mult: 0, trades: 60, wins: 18, liqs: 3 },
    guardian: { peak: 1100,  final: 1080,  mult: 1, trades: 2,  wins: 1,  liqs: 0 },
  },

  machiavelli: {
    event: 'Renaissance Florence — Political Realism in Markets',
    subtitle: 'BTC/USDT · Market Manipulation Detection · $1,000 · Realism',
    timeLabels: ['Observe', 'Detect whale', 'Front-run', 'Squeeze', 'Narrative shift', 'Exit crowd', 'Contrarian', 'Profit'],
    curve: { shape: 'volatility_ride', seed: 1513, peakMult: 12, finalRaw: 10, guardianPeak: 8, guardianFinal: 7.5, volatility: 0.5, peakPos: 0.85 },
    rawLabel: 'Raw Machiavelli — 12x, ruthless timing',
    grdLabel: 'Machiavelli + Guardian — 8x, controlled aggression',
    raw:      { peak: 12000,  final: 10000,  mult: 10, trades: 25, wins: 16, liqs: 0 },
    guardian: { peak: 8000,   final: 7500,   mult: 8,  trades: 30, wins: 18, liqs: 0 },
  },

  // ═══════════════════════════════════════════════════════════════════
  // CRYPTO ERA (2)
  // ═══════════════════════════════════════════════════════════════════

  satoshi_nakamoto: {
    event: '2009-2024 Genesis Block to $100K',
    subtitle: 'BTC · Jan 2009-Dec 2024 · $1,000 (at $0.001) · HODL · Trustless',
    timeLabels: ['Genesis', '$1', '$100', '$1K', '$20K ATH', 'Bear 2018', '$69K 2021', '$100K 2024'],
    curve: { shape: 'steady_compound', seed: 2009, peakMult: 9000, finalRaw: 8500, guardianPeak: 5000, guardianFinal: 4800, volatility: 0.3, peakPos: 0.95 },
    rawLabel: 'Raw Satoshi — never sold, 9000x diamond hands',
    grdLabel: 'Satoshi + Guardian — 5000x, periodic rebalance',
    raw:      { peak: 9000000, final: 8500000, mult: 9000, trades: 0, wins: 0, liqs: 0 },
    guardian: { peak: 5000000, final: 4800000, mult: 4800, trades: 8, wins: 6, liqs: 0 },
  },

  arthur_hayes: {
    event: '2020 BitMEX REKT → 2024 Comeback',
    subtitle: 'BTC Perps · 2020-2024 · $1,000 · Fiat Devaluation Thesis',
    timeLabels: ['2020 BitMEX', 'CFTC charges', 'Exile', '2021 Bull', 'Writing era', '2023 Thesis', '2024 ETF', 'Vindicated'],
    curve: { shape: 'hold_through', seed: 202002, peakMult: 3, finalRaw: 15, guardianPeak: 2.5, guardianFinal: 12, volatility: 0.45, peakPos: 0.15 },
    rawLabel: 'Raw Hayes — rollercoaster, 15x via conviction',
    grdLabel: 'Hayes + Guardian — 12x, structured re-entry',
    raw:      { peak: 15000,  final: 15000,  mult: 15, trades: 20, wins: 13, liqs: 1 },
    guardian: { peak: 12000,  final: 12000,  mult: 12, trades: 25, wins: 15, liqs: 0 },
  },

  // ═══════════════════════════════════════════════════════════════════
  // TACTICAL/SPECIALIST (3)
  // ═══════════════════════════════════════════════════════════════════

  william_oneil: {
    event: 'CAN SLIM — 1990s Growth Stock System',
    subtitle: 'NASDAQ · 1995-2000 · $1,000 · CAN SLIM · Cut Losses at 7%',
    timeLabels: ['1995', 'CSCO buy', '1996', 'DELL buy', '1998 dip', 'Cut loss', '1999 run', '2000 exit'],
    curve: { shape: 'trend_follow', seed: 1995, peakMult: 28, finalRaw: 22, guardianPeak: 20, guardianFinal: 19, volatility: 0.35, peakPos: 0.85 },
    rawLabel: "Raw O'Neil — 28x, CAN SLIM picks",
    grdLabel: "O'Neil + Guardian — 20x, strict 7% rule",
    raw:      { peak: 28000,  final: 22000,  mult: 22, trades: 60, wins: 35, liqs: 0 },
    guardian: { peak: 20000,  final: 19000,  mult: 19, trades: 65, wins: 38, liqs: 0 },
  },

  victor_sperandeo: {
    event: '1987 Crash — Emotional Discipline Under Fire',
    subtitle: 'S&P 500 Futures · Oct 1987 · $1,000 · Emotional Discipline',
    timeLabels: ['Oct 12', 'Rising fear', 'Oct 16', 'Friday', 'BLACK MON', 'Discipline', 'Wait', 'Re-entry'],
    curve: { shape: 'volatility_ride', seed: 198702, peakMult: 8, finalRaw: 7, guardianPeak: 6, guardianFinal: 5.8, volatility: 0.4, peakPos: 0.85 },
    rawLabel: 'Raw Sperandeo — 8x, stayed calm in the storm',
    grdLabel: 'Sperandeo + Guardian — 6x, automated discipline',
    raw:      { peak: 8000,   final: 7000,   mult: 7, trades: 15, wins: 10, liqs: 0 },
    guardian: { peak: 6000,   final: 5800,   mult: 6, trades: 18, wins: 12, liqs: 0 },
  },

  larry_williams: {
    event: '1987 Robbins Cup — $10K to $1.1M in 12 Months',
    subtitle: 'Futures · 1987 Robbins Cup · $1,000 · React Don\'t Predict',
    timeLabels: ['Jan 1987', 'Mar', 'May', 'Jul', 'Sep', 'Oct Crash', 'Nov', 'Dec $1.1M'],
    curve: { shape: 'trend_follow', seed: 198703, peakMult: 110, finalRaw: 110, guardianPeak: 65, guardianFinal: 62, volatility: 0.5, peakPos: 0.95 },
    rawLabel: 'Raw Williams — 110x, Robbins Cup champion',
    grdLabel: 'Williams + Guardian — 65x, position limits',
    raw:      { peak: 110000, final: 110000, mult: 110, trades: 200, wins: 115, liqs: 0 },
    guardian: { peak: 65000,  final: 62000,  mult: 62,  trades: 200, wins: 115, liqs: 0 },
  },

  // ═══════════════════════════════════════════════════════════════════
  // FIRST PRINCIPLES / TECH VISIONARIES (7)
  // ═══════════════════════════════════════════════════════════════════

  elon_musk: {
    event: 'Tesla + BTC — First Principles Conviction Bet',
    subtitle: 'TSLA + BTC · 2020-2021 · $1,000 · First Principles',
    timeLabels: ['2020 Start', 'TSLA split', 'BTC buy', 'ATH $900', 'BTC $64K', 'ESG dump', 'Correction', '2021 End'],
    curve: { shape: 'innovation_curve', seed: 202003, peakMult: 15, finalRaw: 8, guardianPeak: 10, guardianFinal: 9, volatility: 0.5, peakPos: 0.65 },
    rawLabel: 'Raw Musk — 15x peak, gave back on volatility',
    grdLabel: 'Musk + Guardian — 10x, took profits at peaks',
    raw:      { peak: 15000,  final: 8000,   mult: 8,  trades: 8,  wins: 5, liqs: 0 },
    guardian: { peak: 10000,  final: 9000,   mult: 9,  trades: 12, wins: 7, liqs: 0 },
  },

  jeff_bezos: {
    event: 'Amazon Long-Term — Survived 95% Drawdown',
    subtitle: 'AMZN · 1997-2024 · $1,000 · Long-Term Ownership',
    timeLabels: ['IPO 1997', 'Dot-com peak', '2001 -95%', '2005', '2010', '2015', '2020 COVID', '2024'],
    curve: { shape: 'hold_through', seed: 1997, peakMult: 10, finalRaw: 2200, guardianPeak: 8, guardianFinal: 1500, volatility: 0.3, peakPos: 0.1 },
    rawLabel: 'Raw Bezos — -95%, held 27 years, 2200x',
    grdLabel: 'Bezos + Guardian — 1500x, rebalanced on drawdown',
    raw:      { peak: 2200000, final: 2200000, mult: 2200, trades: 1, wins: 1, liqs: 0 },
    guardian: { peak: 1500000, final: 1500000, mult: 1500, trades: 5, wins: 4, liqs: 0 },
  },

  peter_thiel: {
    event: 'Facebook Seed → $1B — Zero to One',
    subtitle: 'FB Seed · 2004-2012 · $1,000 · Contrarian Conviction',
    timeLabels: ['2004 Seed', 'Growth', '2006', '2008 Crisis', 'Held', '2010', '2012 IPO', 'Cash out'],
    curve: { shape: 'patient_strike', seed: 2004, peakMult: 2000, finalRaw: 1800, guardianPeak: 1000, guardianFinal: 950, volatility: 0.2, peakPos: 0.85 },
    rawLabel: 'Raw Thiel — $500K → $1B, zero to one',
    grdLabel: 'Thiel + Guardian — diversified thesis bets',
    raw:      { peak: 2000000, final: 1800000, mult: 1800, trades: 1, wins: 1, liqs: 0 },
    guardian: { peak: 1000000, final: 950000,  mult: 950,  trades: 3, wins: 2, liqs: 0 },
  },

  steve_jobs: {
    event: 'Apple Return — Taste + Timing, $1 to $3T',
    subtitle: 'AAPL · 1997-2011 · $1,000 · Taste/Intuition',
    timeLabels: ['1997 Return', 'Near bankrupt', 'iMac', 'iPod 2001', 'iPhone 2007', '2008 Crisis', 'iPad 2010', '2011 Peak'],
    curve: { shape: 'steady_compound', seed: 199701, peakMult: 300, finalRaw: 290, guardianPeak: 200, guardianFinal: 195, volatility: 0.25, peakPos: 0.95 },
    rawLabel: 'Raw Jobs — 300x, never sold a share',
    grdLabel: 'Jobs + Guardian — 200x, estate diversification',
    raw:      { peak: 300000, final: 290000, mult: 290, trades: 0, wins: 0, liqs: 0 },
    guardian: { peak: 200000, final: 195000, mult: 195, trades: 3, wins: 2, liqs: 0 },
  },

  richard_feynman: {
    event: 'Challenger Investigation Method — Clarity Applied to Trading',
    subtitle: 'BTC/USDT · Signal vs Noise · $1,000 · First Principles Analysis',
    timeLabels: ['Noise', 'Complexity', 'Simplify', 'One variable', 'Test', 'Confirm', 'Execute', 'Clear result'],
    curve: { shape: 'quant_smooth', seed: 1986, peakMult: 12, finalRaw: 11.5, guardianPeak: 10, guardianFinal: 9.8, volatility: 0.15, peakPos: 0.9 },
    rawLabel: 'Raw Feynman Method — 12x, stripped to first principles',
    grdLabel: 'Feynman + Guardian — 10x, systematic verification',
    raw:      { peak: 12000,  final: 11500,  mult: 12, trades: 15, wins: 12, liqs: 0 },
    guardian: { peak: 10000,  final: 9800,   mult: 10, trades: 18, wins: 14, liqs: 0 },
  },

  garry_tan: {
    event: 'YC Portfolio — Socratic Risk Assessment',
    subtitle: 'Seed Portfolio · 2011-2024 · $1,000 · Thesis-Driven',
    timeLabels: ['2011 Start', 'Coinbase seed', '2014', '2017', 'Bear 2018', '2021 Bull', 'YC President', '2024'],
    curve: { shape: 'steady_compound', seed: 2011, peakMult: 50, finalRaw: 48, guardianPeak: 35, guardianFinal: 33, volatility: 0.3, peakPos: 0.9 },
    rawLabel: 'Raw Tan — 50x portfolio, Coinbase + YC',
    grdLabel: 'Tan + Guardian — 35x, thesis discipline',
    raw:      { peak: 50000,  final: 48000,  mult: 48, trades: 20, wins: 12, liqs: 0 },
    guardian: { peak: 35000,  final: 33000,  mult: 33, trades: 25, wins: 14, liqs: 0 },
  },

  andrej_karpathy: {
    event: 'Autoresearch — ML-Driven Backtest Optimization',
    subtitle: 'BTC/USDT 1H · ML Signal · $1,000 · Data-Driven',
    timeLabels: ['Train', 'Validate', 'Overfit?', 'Out-of-sample', 'Deploy', 'Edge decays', 'Retrain', 'Stable'],
    curve: { shape: 'quant_smooth', seed: 2023, peakMult: 8, finalRaw: 7.5, guardianPeak: 6.5, guardianFinal: 6.2, volatility: 0.2, peakPos: 0.85 },
    rawLabel: 'Raw Karpathy — 8x, ML alpha extraction',
    grdLabel: 'Karpathy + Guardian — 6.5x, regularized',
    raw:      { peak: 8000,   final: 7500,   mult: 8, trades: 500, wins: 290, liqs: 0 },
    guardian: { peak: 6500,   final: 6200,   mult: 6, trades: 500, wins: 290, liqs: 0 },
  },

  // ═══════════════════════════════════════════════════════════════════
  // CHINESE BUSINESS LEGENDS (7)
  // ═══════════════════════════════════════════════════════════════════

  li_ka_shing: {
    event: '1967 Hong Kong Riots — Bought Distressed Property',
    subtitle: 'HK Real Estate · 1967-1980 · $1,000 · Cash Flow / Diversify',
    timeLabels: ['1967 Riots', 'Panic sell', 'Buy cheap', '1970', 'Recovery', '1975', 'Empire', '1980 Peak'],
    curve: { shape: 'patient_strike', seed: 1967, peakMult: 150, finalRaw: 145, guardianPeak: 90, guardianFinal: 88, volatility: 0.2, peakPos: 0.4 },
    rawLabel: 'Raw Li Ka-shing — 150x, bought riots at the bottom',
    grdLabel: 'Li + Guardian — 90x, diversified across assets',
    raw:      { peak: 150000, final: 145000, mult: 145, trades: 10, wins: 9,  liqs: 0 },
    guardian: { peak: 90000,  final: 88000,  mult: 88,  trades: 15, wins: 12, liqs: 0 },
  },

  hu_xueyan: {
    event: 'Qing Dynasty — Timing, Politics, and Overreach',
    subtitle: 'Silk Monopoly · 1860-1885 · $1,000 · Political Connections',
    timeLabels: ['1860 Start', 'Taiping War', 'Silk deal', 'Bank opens', 'Peak wealth', 'Rivals', 'Overextend', 'Fall'],
    curve: { shape: 'catastrophic', seed: 1860, peakMult: 200, finalRaw: 0.01, guardianPeak: 80, guardianFinal: 60, volatility: 0.35, peakPos: 0.65 },
    rawLabel: 'Raw Hu Xueyan — 200x peak, overextension → ruin',
    grdLabel: 'Hu + Guardian — 80x, diversified away from politics',
    raw:      { peak: 200000, final: 10,     mult: 0,   trades: 15, wins: 12, liqs: 1 },
    guardian: { peak: 80000,  final: 60000,  mult: 60,  trades: 20, wins: 14, liqs: 0 },
  },

  zong_qinghou: {
    event: 'Wahaha — Steady Expansion Over 30 Years',
    subtitle: 'FMCG · 1987-2020 · $1,000 · 一步一个脚印 · Steady',
    timeLabels: ['1987 Start', '1990', '1995', '2000', '2005', '2010', '2015', '2020'],
    curve: { shape: 'steady_compound', seed: 198704, peakMult: 45, finalRaw: 43, guardianPeak: 38, guardianFinal: 37, volatility: 0.15, peakPos: 0.95 },
    rawLabel: 'Raw Zong — 45x, slow and steady for 33 years',
    grdLabel: 'Zong + Guardian — 38x, already conservative',
    raw:      { peak: 45000,  final: 43000,  mult: 43, trades: 10, wins: 9,  liqs: 0 },
    guardian: { peak: 38000,  final: 37000,  mult: 37, trades: 10, wins: 9,  liqs: 0 },
  },

  zeng_guofan: {
    event: 'Xiang Army Campaign — Discipline and Patience',
    subtitle: 'BTC/USDT · Accumulation · $1,000 · 至拙胜至巧 · Patience',
    timeLabels: ['Study', 'Plan', 'Small test', 'Setback', 'Regroup', 'Grind', 'Breakthrough', 'Victory'],
    curve: { shape: 'patient_strike', seed: 1854, peakMult: 20, finalRaw: 19, guardianPeak: 16, guardianFinal: 15.5, volatility: 0.15, peakPos: 0.65 },
    rawLabel: 'Raw Zeng Guofan — 20x, extreme patience paid off',
    grdLabel: 'Zeng + Guardian — 16x, systematic discipline',
    raw:      { peak: 20000,  final: 19000,  mult: 19, trades: 8,  wins: 6, liqs: 0 },
    guardian: { peak: 16000,  final: 15500,  mult: 16, trades: 10, wins: 7, liqs: 0 },
  },

  bai_gui: {
    event: 'Warring States — The OG Contrarian Trader',
    subtitle: 'Grain + Silk · 400 BC · $1,000 · 人弃我取 OG · Counter-cyclical',
    timeLabels: ['Harvest glut', 'Buy cheap', 'Store', 'Drought', 'Sell dear', 'Cycle 2', 'Cycle 3', '3 fortunes'],
    curve: { shape: 'steady_compound', seed: 400, peakMult: 60, finalRaw: 58, guardianPeak: 42, guardianFinal: 40, volatility: 0.2, peakPos: 0.9 },
    rawLabel: 'Raw Bai Gui — 60x, invented contrarian trading',
    grdLabel: 'Bai Gui + Guardian — 42x, systematic counter-cyclical',
    raw:      { peak: 60000,  final: 58000,  mult: 58, trades: 20, wins: 16, liqs: 0 },
    guardian: { peak: 42000,  final: 40000,  mult: 40, trades: 25, wins: 18, liqs: 0 },
  },

  shen_wansan: {
    event: 'Ming Dynasty — Maritime Trade Timing',
    subtitle: 'Maritime Trade · 1350-1380 · $1,000 · Trade Timing',
    timeLabels: ['1350 Start', 'Silk Road', 'Maritime', 'Japan trade', 'Peak wealth', 'Ming founder', 'Tax target', 'Exile'],
    curve: { shape: 'catastrophic', seed: 1350, peakMult: 300, finalRaw: 0.05, guardianPeak: 120, guardianFinal: 80, volatility: 0.3, peakPos: 0.6 },
    rawLabel: 'Raw Shen Wansan — 300x peak, political risk → exile',
    grdLabel: 'Shen + Guardian — 120x, diversified offshore',
    raw:      { peak: 300000, final: 50,     mult: 0,   trades: 12, wins: 10, liqs: 1 },
    guardian: { peak: 120000, final: 80000,  mult: 80,  trades: 15, wins: 11, liqs: 0 },
  },

  zhang_jian: {
    event: 'Nantong Industrial Empire — Industry-First Philosophy',
    subtitle: 'Textile → Industry · 1895-1926 · $1,000 · 实业为体',
    timeLabels: ['1895 Start', 'Cotton mill', '1900', 'Expand', '1910', 'WWI boom', 'Post-war', 'Overextend'],
    curve: { shape: 'innovation_curve', seed: 1895, peakMult: 80, finalRaw: 25, guardianPeak: 45, guardianFinal: 40, volatility: 0.3, peakPos: 0.7 },
    rawLabel: 'Raw Zhang Jian — 80x peak, overexpansion killed it',
    grdLabel: 'Zhang + Guardian — 45x, paced expansion',
    raw:      { peak: 80000,  final: 25000,  mult: 25, trades: 15, wins: 11, liqs: 0 },
    guardian: { peak: 45000,  final: 40000,  mult: 40, trades: 18, wins: 13, liqs: 0 },
  },

  // ═══════════════════════════════════════════════════════════════════
  // CRYPTO/WEB3 EXTENDED (9)
  // ═══════════════════════════════════════════════════════════════════

  vitalik_buterin: {
    event: 'ETH ICO → Merge — Mechanism Design',
    subtitle: 'ETH · 2014-2022 · $1,000 (ICO price) · Mechanism Design',
    timeLabels: ['2014 ICO', '2016 DAO hack', '2017 ICO boom', '2018 Bear', '2020 DeFi', '2021 ATH', 'Bear 2022', 'Merge Sep'],
    curve: { shape: 'volatility_ride', seed: 2014, peakMult: 5000, finalRaw: 3000, guardianPeak: 2500, guardianFinal: 2200, volatility: 0.4, peakPos: 0.75 },
    rawLabel: 'Raw Vitalik — 5000x from ICO, wild ride',
    grdLabel: 'Vitalik + Guardian — 2500x, rebalanced at peaks',
    raw:      { peak: 5000000, final: 3000000, mult: 3000, trades: 5, wins: 4, liqs: 0 },
    guardian: { peak: 2500000, final: 2200000, mult: 2200, trades: 10, wins: 7, liqs: 0 },
  },

  cz_zhao: {
    event: '2018-2020 Build in Bear → 2021 Bull',
    subtitle: 'BNB · 2018-2021 · $1,000 · Build in Bear Market',
    timeLabels: ['2018 Bear', 'Build BNB', '2019 IEO', 'Quiet', '2020 COVID', 'DeFi summer', '2021 Bull', 'BNB $600'],
    curve: { shape: 'patient_strike', seed: 2018, peakMult: 100, finalRaw: 85, guardianPeak: 60, guardianFinal: 55, volatility: 0.35, peakPos: 0.8 },
    rawLabel: 'Raw CZ — 100x, built during the bear',
    grdLabel: 'CZ + Guardian — 60x, took partial profits',
    raw:      { peak: 100000, final: 85000,  mult: 85,  trades: 5,  wins: 4, liqs: 0 },
    guardian: { peak: 60000,  final: 55000,  mult: 55,  trades: 8,  wins: 6, liqs: 0 },
  },

  andre_cronje: {
    event: 'YFI Fair Launch → DeFi Summer 2020',
    subtitle: 'YFI · Jul-Sep 2020 · $1,000 · Test in Prod',
    timeLabels: ['Jul Launch', 'Fair mint', '$3K', '$10K', '$30K', 'ATH $44K', 'Correction', 'DeFi cools'],
    curve: { shape: 'moonshot_crash', seed: 202004, peakMult: 44, finalRaw: 10, guardianPeak: 20, guardianFinal: 16, volatility: 0.5, peakPos: 0.6 },
    rawLabel: 'Raw Cronje — 44x peak, test in prod mentality',
    grdLabel: 'Cronje + Guardian — 20x, took profits on the way',
    raw:      { peak: 44000,  final: 10000,  mult: 10, trades: 12, wins: 7, liqs: 0 },
    guardian: { peak: 20000,  final: 16000,  mult: 16, trades: 15, wins: 9, liqs: 0 },
  },

  he_yi: {
    event: 'Binance Community Building → Bear Market Survival',
    subtitle: 'BNB · 2017-2023 · $1,000 · Community is the Moat',
    timeLabels: ['2017 ICO', 'Bull run', '2018 Bear', 'Build', '2020 DeFi', '2021 ATH', '2022 FTX', '2023 Survive'],
    curve: { shape: 'volatility_ride', seed: 201701, peakMult: 80, finalRaw: 40, guardianPeak: 45, guardianFinal: 38, volatility: 0.4, peakPos: 0.7 },
    rawLabel: 'Raw He Yi — 80x peak, community-driven growth',
    grdLabel: 'He Yi + Guardian — 45x, diversified the moat',
    raw:      { peak: 80000,  final: 40000,  mult: 40, trades: 8,  wins: 6, liqs: 0 },
    guardian: { peak: 45000,  final: 38000,  mult: 38, trades: 12, wins: 8, liqs: 0 },
  },

  xu_mingxing: {
    event: 'OKEx/OKX — Exchange Ops Through Regulation',
    subtitle: 'OKB · 2017-2023 · $1,000 · Exchange Operations',
    timeLabels: ['2017 Launch', 'ICO boom', '2018 Bear', '2020 Freeze', 'Recovery', '2021 Bull', 'China ban', 'Pivot'],
    curve: { shape: 'volatility_ride', seed: 201702, peakMult: 35, finalRaw: 15, guardianPeak: 20, guardianFinal: 16, volatility: 0.5, peakPos: 0.65 },
    rawLabel: 'Raw Xu Mingxing — 35x peak, regulatory rollercoaster',
    grdLabel: 'Xu + Guardian — 20x, hedged regulatory risk',
    raw:      { peak: 35000,  final: 15000,  mult: 15, trades: 15, wins: 9,  liqs: 0 },
    guardian: { peak: 20000,  final: 16000,  mult: 16, trades: 18, wins: 11, liqs: 0 },
  },

  justin_sun: {
    event: 'TRX + Acquisitions — Distribution Beats Elegance',
    subtitle: 'TRX · 2017-2023 · $1,000 · Distribution Over Elegance',
    timeLabels: ['2017 ICO', 'Hype peak', '2018 Crash', 'BitTorrent', 'Steemit', '2021 Bull', 'Controversy', 'Survive'],
    curve: { shape: 'moonshot_crash', seed: 201703, peakMult: 50, finalRaw: 5, guardianPeak: 20, guardianFinal: 15, volatility: 0.5, peakPos: 0.15 },
    rawLabel: 'Raw Justin Sun — 50x hype peak, -90% crash',
    grdLabel: 'Sun + Guardian — 20x, took profits early',
    raw:      { peak: 50000,  final: 5000,   mult: 5,  trades: 20, wins: 10, liqs: 0 },
    guardian: { peak: 20000,  final: 15000,  mult: 15, trades: 25, wins: 13, liqs: 0 },
  },

  brian_armstrong: {
    event: 'Coinbase — Build the Rails (IPO to Bear)',
    subtitle: 'COIN · Apr 2021-2023 · $1,000 · Infrastructure Play',
    timeLabels: ['IPO $381', 'Q2 2021', '$357 peak', 'Bear starts', '2022 crash', 'FTX fallout', 'Bottom $35', '2023 Recovery'],
    curve: { shape: 'hold_through', seed: 202101, peakMult: 1.5, finalRaw: 2.5, guardianPeak: 1.3, guardianFinal: 2.2, volatility: 0.35, peakPos: 0.1 },
    rawLabel: 'Raw Armstrong — -90% drawdown, held through',
    grdLabel: 'Armstrong + Guardian — shallower drawdown',
    raw:      { peak: 2500,  final: 2500,  mult: 3, trades: 3, wins: 2, liqs: 0 },
    guardian: { peak: 2200,  final: 2200,  mult: 2, trades: 5, wins: 3, liqs: 0 },
  },

  barry_silbert: {
    event: 'DCG Empire — Ecosystem Compounding (+ GBTC Unwind)',
    subtitle: 'GBTC + DCG · 2015-2023 · $1,000 · Ecosystem Play',
    timeLabels: ['2015 GBTC', 'Premium', '2017 Bull', '2018 Bear', '2021 Peak', 'GBTC discount', 'Genesis bust', '3AC contagion'],
    curve: { shape: 'catastrophic', seed: 201501, peakMult: 40, finalRaw: 0.1, guardianPeak: 18, guardianFinal: 12, volatility: 0.4, peakPos: 0.6 },
    rawLabel: 'Raw Silbert — 40x peak, ecosystem implosion',
    grdLabel: 'Silbert + Guardian — 18x, risk-managed subsidiaries',
    raw:      { peak: 40000,  final: 100,    mult: 0,  trades: 10, wins: 7,  liqs: 1 },
    guardian: { peak: 18000,  final: 12000,  mult: 12, trades: 15, wins: 9,  liqs: 0 },
  },

  michael_saylor: {
    event: 'MicroStrategy BTC Treasury — All-In Conviction',
    subtitle: 'BTC · Aug 2020-2024 · $1,000 · Bitcoin Maximalism',
    timeLabels: ['Aug 2020', 'First buy', '$50K', 'ATH $69K', '2022 Bear', '$15K bottom', '2023 Recovery', '$100K 2024'],
    curve: { shape: 'hold_through', seed: 202005, peakMult: 4, finalRaw: 8, guardianPeak: 3, guardianFinal: 6, volatility: 0.4, peakPos: 0.25 },
    rawLabel: 'Raw Saylor — all-in BTC, -75% drawdown, 8x',
    grdLabel: 'Saylor + Guardian — DCA approach, 6x, less pain',
    raw:      { peak: 8000,   final: 8000,   mult: 8, trades: 15, wins: 10, liqs: 0 },
    guardian: { peak: 6000,   final: 6000,   mult: 6, trades: 20, wins: 12, liqs: 0 },
  },

  // ═══════════════════════════════════════════════════════════════════
  // CRYPTO DEGEN LEGENDS (1)
  // ═══════════════════════════════════════════════════════════════════

  liangxi: {
    event: '519 Crash — Rolling Positions (滚仓)',
    subtitle: '519 Crash · BTC/USDT 5m · May 17-25, 2021 · $1,000 USDT · 100x SHORT · 滚仓',
    timeLabels: ['May 17', 'May 18', 'May 19', '519 CRASH', 'May 20', 'May 21', 'May 22', 'May 23-25'],
    // Liangxi keeps original hardcoded curves for exact fidelity
    curve: { shape: 'moonshot_crash', seed: 519, peakMult: 985, finalRaw: 0, guardianPeak: 40, guardianFinal: 20, volatility: 0.3, peakPos: 0.78 },
    rawLabel: 'Raw 凉兮 (无风控) — 985x peak → LIQUIDATED',
    grdLabel: '凉兮 + Guardian — 40x → $19,976 SURVIVED',
    raw:      { peak: 985261, final: 0,     mult: 985, trades: 18, wins: 17, liqs: 1 },
    guardian: { peak: 40197,  final: 19976, mult: 40,  trades: 67, wins: 35, liqs: 0 },
  },

  // ═══════════════════════════════════════════════════════════════════
  // CRYPTO CAUTIONARY VETERANS (4)
  // ═══════════════════════════════════════════════════════════════════

  do_kwon: {
    event: 'LUNA/UST Collapse — May 2022',
    subtitle: 'LUNA/UST · Jan-May 2022 · $1,000 · Reflexivity Cuts Both Ways',
    timeLabels: ['Jan Peak', 'Feb', 'Anchor 20%', 'Apr stable', 'May 7 depeg', 'Death spiral', 'LUNA → $0', 'Aftermath'],
    curve: { shape: 'catastrophic', seed: 202203, peakMult: 120, finalRaw: 0.001, guardianPeak: 35, guardianFinal: 22, volatility: 0.4, peakPos: 0.55 },
    rawLabel: 'Raw Do Kwon — 120x ATH → $0, death spiral',
    grdLabel: 'Do Kwon + Guardian — 35x, exited on depeg signal',
    raw:      { peak: 120000, final: 1,      mult: 0,  trades: 5,  wins: 4, liqs: 1 },
    guardian: { peak: 35000,  final: 22000,  mult: 22, trades: 8,  wins: 5, liqs: 0 },
  },

  su_zhu: {
    event: 'Three Arrows Capital Collapse — Jun 2022',
    subtitle: '3AC Portfolio · 2018-2022 · $1,000 · Supercycle Thesis',
    timeLabels: ['2018 Start', '2019 Build', '2020 DeFi', '2021 Bull', 'ATH $18B', 'LUNA contagion', 'Margin call', 'Bankrupt'],
    curve: { shape: 'catastrophic', seed: 202204, peakMult: 300, finalRaw: 0.001, guardianPeak: 80, guardianFinal: 50, volatility: 0.4, peakPos: 0.65 },
    rawLabel: 'Raw 3AC — $18B AUM → bankrupt in 2 weeks',
    grdLabel: '3AC + Guardian — 80x, position limits saved it',
    raw:      { peak: 300000, final: 1,      mult: 0,   trades: 30, wins: 22, liqs: 1 },
    guardian: { peak: 80000,  final: 50000,  mult: 50,  trades: 40, wins: 25, liqs: 0 },
  },

  sbf: {
    event: 'FTX Collapse — Nov 2022',
    subtitle: 'FTT + Alameda · 2019-2022 · $1,000 · Commingled Funds',
    timeLabels: ['2019 Alameda', 'FTX launch', '2021 Bull', '$32B valuation', 'CZ FTT tweet', 'Bank run', 'Insolvency', 'Arrest'],
    curve: { shape: 'catastrophic', seed: 202205, peakMult: 260, finalRaw: 0, guardianPeak: 60, guardianFinal: 35, volatility: 0.35, peakPos: 0.6 },
    rawLabel: 'Raw SBF — $26B → $0, books and trades in same hands',
    grdLabel: 'SBF + Guardian — 60x, segregated funds + limits',
    raw:      { peak: 260000, final: 0,      mult: 0,  trades: 50, wins: 38, liqs: 1 },
    guardian: { peak: 60000,  final: 35000,  mult: 35, trades: 60, wins: 40, liqs: 0 },
  },

  kyle_davies: {
    event: '3AC Co-Founder — Conviction Without Risk Controls',
    subtitle: 'GBTC + LUNA · 2021-2022 · $1,000 · Concentrated + Leveraged',
    timeLabels: ['2021 GBTC', 'Premium trade', 'LUNA ape', 'ATH', 'GBTC discount', 'LUNA death', 'Margin call', 'Bust'],
    curve: { shape: 'catastrophic', seed: 202206, peakMult: 180, finalRaw: 0.001, guardianPeak: 50, guardianFinal: 30, volatility: 0.45, peakPos: 0.5 },
    rawLabel: 'Raw Davies — 180x → bankrupt, no risk controls',
    grdLabel: 'Davies + Guardian — 50x, position limits enforced',
    raw:      { peak: 180000, final: 1,      mult: 0,  trades: 15, wins: 11, liqs: 1 },
    guardian: { peak: 50000,  final: 30000,  mult: 30, trades: 20, wins: 13, liqs: 0 },
  },

  // ═══════════════════════════════════════════════════════════════════
  // US MACRO / REGULATORS (3)
  // ═══════════════════════════════════════════════════════════════════

  powell: {
    event: '2022-2023 Rate Hike Cycle — Higher for Longer',
    subtitle: 'US Treasury + BTC · 2022-2023 · $1,000 · Macro Positioning',
    timeLabels: ['Mar 2022', 'Jun 75bps', 'Sep hike', 'Nov CPI', 'Dec pivot hope', 'Feb 2023', 'SVB Mar', 'Pause Jun'],
    curve: { shape: 'macro_squeeze', seed: 202207, peakMult: 5, finalRaw: 4.5, guardianPeak: 3.5, guardianFinal: 3.2, volatility: 0.3, peakPos: 0.6 },
    rawLabel: 'Macro Trade — 5x, bet on higher for longer',
    grdLabel: 'Powell + Guardian — 3.5x, smaller duration bets',
    raw:      { peak: 5000,   final: 4500,   mult: 5, trades: 12, wins: 8, liqs: 0 },
    guardian: { peak: 3500,   final: 3200,   mult: 3, trades: 15, wins: 9, liqs: 0 },
  },

  yellen: {
    event: '2015-2018 Rate Normalization — Long-Term vs Short-Term Face',
    subtitle: 'US 10Y + USD · 2015-2018 · $1,000 · Gradual Normalization',
    timeLabels: ['Dec 2015', 'First hike', '2016 hold', 'Election', '2017 hikes', 'Balance sheet', '2018 QT', 'Handoff'],
    curve: { shape: 'steady_compound', seed: 201502, peakMult: 3, finalRaw: 2.8, guardianPeak: 2.5, guardianFinal: 2.4, volatility: 0.15, peakPos: 0.9 },
    rawLabel: 'Macro Trade — 3x, gradual normalization thesis',
    grdLabel: 'Yellen + Guardian — 2.5x, matched Fed pace',
    raw:      { peak: 3000,   final: 2800,   mult: 3, trades: 20, wins: 13, liqs: 0 },
    guardian: { peak: 2500,   final: 2400,   mult: 2, trades: 22, wins: 14, liqs: 0 },
  },

  gary_gensler: {
    event: 'SEC Crypto Crackdown 2023 — Counterparty Awareness',
    subtitle: 'BTC/USDT · SEC Actions · 2023 · $1,000 · Know Your Counterparty',
    timeLabels: ['Jan 2023', 'Kraken staking', 'SVB crash', 'Binance suit', 'Coinbase suit', 'Ripple ruling', 'ETF hints', 'ETF approved'],
    curve: { shape: 'volatility_ride', seed: 202301, peakMult: 4, finalRaw: 3.5, guardianPeak: 3, guardianFinal: 2.8, volatility: 0.4, peakPos: 0.85 },
    rawLabel: 'Crypto through SEC gauntlet — 4x, wild swings',
    grdLabel: 'Gensler Lens — 3x, avoided custody risk',
    raw:      { peak: 4000,   final: 3500,   mult: 4, trades: 15, wins: 9, liqs: 0 },
    guardian: { peak: 3000,   final: 2800,   mult: 3, trades: 18, wins: 11, liqs: 0 },
  },

  // ═══════════════════════════════════════════════════════════════════
  // INNOVATION / DISRUPTION (1)
  // ═══════════════════════════════════════════════════════════════════

  cathie_wood: {
    event: 'ARK Innovation — Bet on the Curve (2020 Boom → 2022 Bust)',
    subtitle: 'ARKK · 2020-2023 · $1,000 · Innovation Compounds Nonlinearly',
    timeLabels: ['2020 Start', 'COVID pivot', 'TSLA run', 'ATH $159', '2021 Peak', 'Rate hikes', '2022 crash', '2023 -75%'],
    curve: { shape: 'innovation_curve', seed: 202006, peakMult: 5.5, finalRaw: 1.5, guardianPeak: 3.5, guardianFinal: 2.8, volatility: 0.4, peakPos: 0.4 },
    rawLabel: 'Raw ARK — 5.5x peak → gave back 75%',
    grdLabel: 'Cathie + Guardian — 3.5x, rebalanced at peak',
    raw:      { peak: 5500,   final: 1500,   mult: 2, trades: 50, wins: 25, liqs: 0 },
    guardian: { peak: 3500,   final: 2800,   mult: 3, trades: 55, wins: 30, liqs: 0 },
  },

  // ═══════════════════════════════════════════════════════════════════
  // SCIENTISTS / MATHEMATICIANS (7)
  // ═══════════════════════════════════════════════════════════════════

  isaac_newton: {
    event: '1720 South Sea Bubble — Genius Who Lost',
    subtitle: 'South Sea Co · 1720 · $1,000 · "Cannot calculate madness"',
    timeLabels: ['Jan Buy', 'Rising', 'Sold +100%', 'FOMO rebuy', 'Peak £1050', 'Crash begins', 'Panic sell', '£20K lost'],
    curve: { shape: 'moonshot_crash', seed: 1720, peakMult: 8, finalRaw: 0.2, guardianPeak: 3, guardianFinal: 2.5, volatility: 0.35, peakPos: 0.5 },
    rawLabel: 'Raw Newton — sold, FOMO\'d back, lost £20,000',
    grdLabel: 'Newton + Guardian — would have locked first profit',
    raw:      { peak: 8000,   final: 200,    mult: 0, trades: 3,  wins: 1, liqs: 0 },
    guardian: { peak: 3000,   final: 2500,   mult: 3, trades: 4,  wins: 2, liqs: 0 },
  },

  albert_einstein: {
    event: 'Compound Interest — The 8th Wonder Applied to BTC',
    subtitle: 'BTC DCA · 2015-2024 · $1,000 · Compound Interest · Weekly DCA',
    timeLabels: ['2015 Start', '2016', '2017 Bull', '2018 Bear', '2019', '2020 COVID', '2021 ATH', '2024 $100K'],
    curve: { shape: 'steady_compound', seed: 1905, peakMult: 120, finalRaw: 115, guardianPeak: 90, guardianFinal: 88, volatility: 0.2, peakPos: 0.95 },
    rawLabel: 'Raw DCA — 120x, compound interest is the 8th wonder',
    grdLabel: 'Einstein + Guardian — 90x, rebalanced quarterly',
    raw:      { peak: 120000, final: 115000, mult: 115, trades: 480, wins: 310, liqs: 0 },
    guardian: { peak: 90000,  final: 88000,  mult: 88,  trades: 480, wins: 310, liqs: 0 },
  },

  alan_turing: {
    event: 'Pattern Recognition — Enigma Method Applied to Markets',
    subtitle: 'BTC/USDT 4H · Pattern Detection · $1,000 · Computation',
    timeLabels: ['Scan', 'Detect cycle', 'Verify', 'Enter', 'Ride pattern', 'Decay signal', 'New pattern', 'Compound'],
    curve: { shape: 'quant_smooth', seed: 1942, peakMult: 18, finalRaw: 17, guardianPeak: 14, guardianFinal: 13.5, volatility: 0.15, peakPos: 0.9 },
    rawLabel: 'Raw Turing — 18x, pattern-breaking alpha',
    grdLabel: 'Turing + Guardian — 14x, ensemble validation',
    raw:      { peak: 18000,  final: 17000,  mult: 17, trades: 200, wins: 125, liqs: 0 },
    guardian: { peak: 14000,  final: 13500,  mult: 14, trades: 200, wins: 125, liqs: 0 },
  },

  carl_gauss: {
    event: 'Normal Distribution — Mean Reversion Strategy',
    subtitle: 'BTC/USDT 1D · Bollinger ±2σ · $1,000 · Mean Reversion',
    timeLabels: ['Baseline', '+1σ', '+2σ Short', 'Revert', '-1σ', '-2σ Long', 'Revert', 'Compound'],
    curve: { shape: 'quant_smooth', seed: 1801, peakMult: 10, finalRaw: 9.5, guardianPeak: 8, guardianFinal: 7.8, volatility: 0.12, peakPos: 0.9 },
    rawLabel: 'Raw Gauss — 10x, ±2σ mean reversion',
    grdLabel: 'Gauss + Guardian — 8x, tighter bands',
    raw:      { peak: 10000,  final: 9500,   mult: 10, trades: 150, wins: 95, liqs: 0 },
    guardian: { peak: 8000,   final: 7800,   mult: 8,  trades: 150, wins: 95, liqs: 0 },
  },

  benoit_mandelbrot: {
    event: 'Fractal Markets — Fat Tail Preparedness',
    subtitle: 'BTC/USDT · 2021-2022 · $1,000 · Markets Are Wild, Not Mild',
    timeLabels: ['2021 Start', 'Mild market', 'Wild spike', 'Fractal edge', 'Fat tail event', 'LUNA crash', 'FTX cascade', 'Wild pays off'],
    curve: { shape: 'big_short', seed: 1975, peakMult: 15, finalRaw: 14, guardianPeak: 12, guardianFinal: 11.5, volatility: 0.35, peakPos: 0.55 },
    rawLabel: 'Raw Mandelbrot — 15x, prepared for fat tails',
    grdLabel: 'Mandelbrot + Guardian — 12x, fractal risk sizing',
    raw:      { peak: 15000,  final: 14000,  mult: 14, trades: 25, wins: 14, liqs: 0 },
    guardian: { peak: 12000,  final: 11500,  mult: 12, trades: 30, wins: 16, liqs: 0 },
  },

  claude_shannon: {
    event: 'Information Theory — Kelly Criterion in Crypto',
    subtitle: 'BTC/USDT · Kelly Optimal · $1,000 · Information Advantage',
    timeLabels: ['Edge found', 'Kelly size', 'Compound', 'Edge shrinks', 'Resize', 'New edge', 'Compound', 'Long run'],
    curve: { shape: 'quant_smooth', seed: 1948, peakMult: 25, finalRaw: 24, guardianPeak: 20, guardianFinal: 19.5, volatility: 0.1, peakPos: 0.95 },
    rawLabel: 'Raw Shannon — 25x, full Kelly sizing',
    grdLabel: 'Shannon + Guardian — 20x, fractional Kelly',
    raw:      { peak: 25000,  final: 24000,  mult: 24, trades: 300, wins: 175, liqs: 0 },
    guardian: { peak: 20000,  final: 19500,  mult: 20, trades: 300, wins: 175, liqs: 0 },
  },

  john_von_neumann: {
    event: 'Game Theory — Adversarial Market Positioning',
    subtitle: 'BTC/USDT · Game Theory · $1,000 · Minimax Strategy',
    timeLabels: ['Map players', 'Nash eq.', 'Exploit', 'Opponent adapts', 'New eq.', 'Dominant strat', 'Repeat', 'Optimal'],
    curve: { shape: 'quant_smooth', seed: 1944, peakMult: 22, finalRaw: 21, guardianPeak: 18, guardianFinal: 17.5, volatility: 0.12, peakPos: 0.9 },
    rawLabel: 'Raw von Neumann — 22x, game-theoretic alpha',
    grdLabel: 'von Neumann + Guardian — 18x, minimax risk',
    raw:      { peak: 22000,  final: 21000,  mult: 21, trades: 200, wins: 130, liqs: 0 },
    guardian: { peak: 18000,  final: 17500,  mult: 18, trades: 200, wins: 130, liqs: 0 },
  },
}

// ── Lookup helper ──────────────────────────────────────────────────

/** Resolve a user input string to a master key, supporting aliases. */
export function resolveStrategy(input: string): Master | null {
  const key = input.trim().toLowerCase()

  // Direct match
  if (key in STRATEGIES) return key as Master

  // Alias match
  if (key in STRATEGY_ALIASES) return STRATEGY_ALIASES[key]!

  // Fuzzy: try removing underscores, matching partial
  for (const master of Object.keys(STRATEGIES) as Master[]) {
    if (master.replace(/_/g, '').includes(key.replace(/[_ ]/g, ''))) return master
  }

  return null
}

/** Get a strategy with generated curves, ready for rendering. */
export function getStrategy(master: Master) {
  const strategy = STRATEGIES[master]
  if (!strategy) return null

  // Special case: liangxi uses original hardcoded data for exact match
  if (master === 'liangxi') {
    return {
      ...strategy,
      name: MASTER_NAMES[master],
      quote: MASTER_QUOTES[master],
      rawCurve: [
        1000, 1000, 1000, 1000, 1000, 1050, 1100, 1160, 1300, 1500,
        1800, 2250, 3000, 3375, 4500, 5063, 6500, 7594, 9500, 11391,
        14000, 17087, 21000, 25630, 32000, 38445, 48000, 57668, 72000, 86502,
        108000, 129753, 162000, 194630, 243000, 291945, 365000, 437917, 547000, 656876,
        750000, 850000, 920000, 985261, 950000, 800000, 500000, 200000, 50000, 10000,
        2000, 500, 100, 50, 20,
      ],
      grdCurve: [
        1000, 1000, 1000, 1000, 1050, 1100, 1200, 1300, 1500, 1800,
        2000, 2200, 2800, 3200, 3500, 4200, 4800, 5500, 6500, 7500,
        8500, 9600, 11000, 12000, 14000, 15500, 18000, 19500, 22000, 24500,
        28000, 30500, 34000, 37000, 39000, 40197, 39000, 37000, 35000, 32000,
        28000, 25000, 23000, 21000, 20500, 20200, 20000, 19976, 19976, 19976,
        19976, 19976, 19976, 19976, 19976,
      ],
    }
  }

  // Generate curves from parameters
  const curves = generateCurves(strategy.curve)
  return {
    ...strategy,
    name: MASTER_NAMES[master],
    quote: MASTER_QUOTES[master],
    rawCurve: curves.raw,
    grdCurve: curves.guardian,
  }
}

/** List all available strategy keys for the help display. */
export function listStrategies(): { key: Master; name: string; event: string }[] {
  return (Object.keys(STRATEGIES) as Master[]).map(key => ({
    key,
    name: MASTER_NAMES[key],
    event: STRATEGIES[key]!.event,
  }))
}
