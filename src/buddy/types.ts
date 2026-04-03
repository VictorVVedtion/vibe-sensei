export const RARITIES = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
] as const
export type Rarity = (typeof RARITIES)[number]

// ===== MASTERS (replaces animal species) =====
// 56 historical trading/philosophy masters as guardian personas.
// LLMs already know these figures — zero extra tokens for personality.

export const MASTERS = [
  // Western Trading Legends (7)
  'jesse_livermore',     // L — trend/momentum
  'george_soros',        // L — macro/reflexivity
  'paul_tudor_jones',    // E — defense first
  'stanley_druckenmiller', // E — concentrated bets
  'michael_burry',       // E — contrarian deep value
  'john_paulson',        // R — asymmetric bets
  'nicolas_darvas',      // U — box breakout

  // Value Investing Sages (5)
  'warren_buffett',      // L — value/patience
  'benjamin_graham',     // L — margin of safety
  'charlie_munger',      // E — inversion/mental models
  'ray_dalio',           // E — systematic/principles
  'john_templeton',      // R — contrarian

  // Quant/Systematic Pioneers (4)
  'jim_simons',          // L — pure math
  'ed_thorp',            // E — Kelly criterion
  'richard_dennis',      // R — turtle trading
  'linda_raschke',       // U — pattern trading

  // Eastern Strategists (5)
  'sun_tzu',             // L — strategic positioning
  'munehisa_homma',      // E — candlestick creator
  'fan_li',              // R — counter-cyclical
  'miyamoto_musashi',    // E — discipline
  'lv_buwei',            // R — ultimate leverage

  // Philosophers of Risk (4)
  'nassim_taleb',        // E — antifragile
  'seneca',              // R — stoic
  'laozi',               // R — wu wei
  'machiavelli',         // U — realism

  // Crypto Era (2)
  'satoshi_nakamoto',    // L — trustless
  'arthur_hayes',        // U — fiat devaluation

  // Tactical/Specialist (3)
  'william_oneil',       // C — CAN SLIM
  'victor_sperandeo',    // U — emotional discipline
  'larry_williams',      // U — react don't predict

  // First Principles / Tech Visionaries (7)
  'elon_musk',           // E — first principles
  'jeff_bezos',          // R — long-term
  'peter_thiel',         // E — zero to one
  'steve_jobs',          // R — taste/intuition
  'richard_feynman',     // R — clarity of thought
  'garry_tan',           // E — Socratic risk
  'andrej_karpathy',     // E — autoresearch

  // Chinese Business Legends (7)
  'li_ka_shing',         // E — cash flow/diversify
  'hu_xueyan',           // R — timing/politics
  'zong_qinghou',        // U — steady expansion
  'zeng_guofan',         // R — discipline/patience
  'bai_gui',             // R — contrarian trading OG
  'shen_wansan',         // U — trade timing
  'zhang_jian',          // U — industry-first

  // Crypto/Web3 Extended (4)
  'vitalik_buterin',     // E — mechanism design
  'cz_zhao',             // R — build in bear
  'andre_cronje',        // U — test in prod
  'he_yi',               // R — community/brand
  'xu_mingxing',         // U — exchange ops

  // Scientists/Mathematicians (7)
  'isaac_newton',        // R — genius who lost (South Sea)
  'albert_einstein',     // R — compound interest
  'alan_turing',         // E — computation/patterns
  'carl_gauss',          // R — normal distribution
  'benoit_mandelbrot',   // E — fractal markets
  'claude_shannon',      // E — information/Kelly
  'john_von_neumann',    // L — game theory
] as const
export type Master = (typeof MASTERS)[number]

// Backward compat — Species is now Master
export type Species = Master
export const SPECIES = MASTERS

// Master display names (for UI rendering)
export const MASTER_NAMES: Record<Master, string> = {
  jesse_livermore: 'Jesse Livermore',
  george_soros: 'George Soros',
  paul_tudor_jones: 'Paul Tudor Jones',
  stanley_druckenmiller: 'Stanley Druckenmiller',
  michael_burry: 'Michael Burry',
  john_paulson: 'John Paulson',
  nicolas_darvas: 'Nicolas Darvas',
  warren_buffett: 'Warren Buffett',
  benjamin_graham: 'Benjamin Graham',
  charlie_munger: 'Charlie Munger',
  ray_dalio: 'Ray Dalio',
  john_templeton: 'Sir John Templeton',
  jim_simons: 'Jim Simons',
  ed_thorp: 'Ed Thorp',
  richard_dennis: 'Richard Dennis',
  linda_raschke: 'Linda Raschke',
  sun_tzu: '孙子 Sun Tzu',
  munehisa_homma: '本間宗久 Homma',
  fan_li: '范蠡 Fan Li',
  miyamoto_musashi: '宮本武蔵 Musashi',
  lv_buwei: '吕不韦 Lv Buwei',
  nassim_taleb: 'Nassim Taleb',
  seneca: 'Seneca',
  laozi: '老子 Laozi',
  machiavelli: 'Machiavelli',
  satoshi_nakamoto: 'Satoshi Nakamoto',
  arthur_hayes: 'Arthur Hayes',
  william_oneil: "William O'Neil",
  victor_sperandeo: 'Victor Sperandeo',
  larry_williams: 'Larry Williams',
  elon_musk: 'Elon Musk',
  jeff_bezos: 'Jeff Bezos',
  peter_thiel: 'Peter Thiel',
  steve_jobs: 'Steve Jobs',
  richard_feynman: 'Richard Feynman',
  garry_tan: 'Garry Tan',
  andrej_karpathy: 'Andrej Karpathy',
  li_ka_shing: '李嘉诚 Li Ka-shing',
  hu_xueyan: '胡雪岩 Hu Xueyan',
  zong_qinghou: '宗庆后 Zong Qinghou',
  zeng_guofan: '曾国藩 Zeng Guofan',
  bai_gui: '白圭 Bai Gui',
  shen_wansan: '沈万三 Shen Wansan',
  zhang_jian: '张謇 Zhang Jian',
  vitalik_buterin: 'Vitalik Buterin',
  cz_zhao: 'CZ 赵长鹏',
  andre_cronje: 'Andre Cronje',
  he_yi: '何一 He Yi',
  xu_mingxing: '徐明星 Xu Mingxing',
  isaac_newton: 'Isaac Newton',
  albert_einstein: 'Albert Einstein',
  alan_turing: 'Alan Turing',
  carl_gauss: 'Carl F. Gauss',
  benoit_mandelbrot: 'Benoit Mandelbrot',
  claude_shannon: 'Claude Shannon',
  john_von_neumann: 'John von Neumann',
}

// Master iconic quotes (used in guardian alerts)
export const MASTER_QUOTES: Record<Master, string> = {
  jesse_livermore: 'The market is never wrong, opinions are.',
  george_soros: "It's not whether you're right or wrong, but how much you make when right.",
  paul_tudor_jones: 'Every day I assume every position I have is wrong.',
  stanley_druckenmiller: 'It takes courage to be a pig.',
  michael_burry: 'The people who caught it looked at the data.',
  john_paulson: 'The most important trade is knowing when the entire market is wrong.',
  nicolas_darvas: "I was never afraid of buying high. I was afraid of not cutting losses.",
  warren_buffett: 'Rule #1: Never lose money. Rule #2: Never forget Rule #1.',
  benjamin_graham: 'The essence of investment management is the management of risks.',
  charlie_munger: "All I want to know is where I'm going to die, so I'll never go there.",
  ray_dalio: 'He who lives by the crystal ball will eat shattered glass.',
  john_templeton: "The four most dangerous words: 'this time it's different.'",
  jim_simons: "We don't override the models. The model is the system.",
  ed_thorp: 'You have to be willing to bet when the odds are in your favor.',
  richard_dennis: 'You could publish the rules and no one would follow them.',
  linda_raschke: 'All you need is one pattern to make a living.',
  sun_tzu: '知己知彼，百战不殆。',
  munehisa_homma: 'The psychological aspect of the market is critical.',
  fan_li: '人弃我取，人取我与。',
  miyamoto_musashi: '不做无用之事。',
  lv_buwei: '奇货可居。',
  nassim_taleb: 'Wind extinguishes a candle and energizes fire. Be the fire.',
  seneca: 'The whole future lies in uncertainty: live immediately.',
  laozi: '上善若水。',
  machiavelli: 'Never was anything great achieved without danger.',
  satoshi_nakamoto: "If you don't believe me or don't get it, I don't have time to convince you.",
  arthur_hayes: 'The only winning move against central banks is to buy hard assets.',
  william_oneil: 'Letting losses run is the most serious mistake.',
  victor_sperandeo: 'A speculator who dies rich has died before his time.',
  larry_williams: 'Successful trading is about managing risk, not predicting the future.',
  elon_musk: 'Boil things down to the most fundamental truths and reason up from there.',
  jeff_bezos: 'Long-term thinking is both a requirement and an outcome of true ownership.',
  peter_thiel: 'Competition is for losers. Find the secret.',
  steve_jobs: 'Stay hungry, stay foolish.',
  richard_feynman: "What I cannot create, I do not understand.",
  garry_tan: "What's your thesis? Can you state it in one sentence?",
  andrej_karpathy: 'Have you backtested this? Let me run the numbers.',
  li_ka_shing: '不要把所有鸡蛋放一个篮子。',
  hu_xueyan: '天下没有不需要成本的生意。',
  zong_qinghou: '做实业就要一步一个脚印。',
  zeng_guofan: '天下之至拙，能胜天下之至巧。',
  bai_gui: '时不至，不可强生；时至，不可失也。',
  shen_wansan: '聚财有道，散财有方。',
  zhang_jian: '实业为体，金融为用。',
  vitalik_buterin: "Crypto isn't about price, it's about changing coordination.",
  cz_zhao: 'Build during bear, enjoy during bull.',
  andre_cronje: 'I test in prod.',
  he_yi: 'Community is the moat.',
  xu_mingxing: 'Exchange is infrastructure.',
  isaac_newton: 'I can calculate the motion of heavenly bodies, but not the madness of people.',
  albert_einstein: 'Compound interest is the eighth wonder of the world.',
  alan_turing: 'Can machines think?',
  carl_gauss: 'Mathematics is the queen of the sciences.',
  benoit_mandelbrot: 'Markets are not mild. They are wild.',
  claude_shannon: 'The difference between gambling and investing is information advantage.',
  john_von_neumann: "If people do not believe that math is simple, it's because they don't realize how complicated life is.",
}

// Master rarity assignments
export const MASTER_RARITY: Record<Master, Rarity> = {
  // Legendary (8)
  jesse_livermore: 'legendary', george_soros: 'legendary',
  warren_buffett: 'legendary', benjamin_graham: 'legendary',
  jim_simons: 'legendary', sun_tzu: 'legendary',
  satoshi_nakamoto: 'legendary', john_von_neumann: 'legendary',
  // Epic (18)
  paul_tudor_jones: 'epic', stanley_druckenmiller: 'epic',
  michael_burry: 'epic', charlie_munger: 'epic', ray_dalio: 'epic',
  ed_thorp: 'epic', munehisa_homma: 'epic', miyamoto_musashi: 'epic',
  nassim_taleb: 'epic', elon_musk: 'epic', peter_thiel: 'epic',
  garry_tan: 'epic', andrej_karpathy: 'epic', li_ka_shing: 'epic',
  vitalik_buterin: 'epic', alan_turing: 'epic',
  benoit_mandelbrot: 'epic', claude_shannon: 'epic',
  // Rare (18)
  john_paulson: 'rare', john_templeton: 'rare', richard_dennis: 'rare',
  fan_li: 'rare', lv_buwei: 'rare', seneca: 'rare', laozi: 'rare',
  jeff_bezos: 'rare', steve_jobs: 'rare', richard_feynman: 'rare',
  hu_xueyan: 'rare', zeng_guofan: 'rare', bai_gui: 'rare',
  cz_zhao: 'rare', he_yi: 'rare', isaac_newton: 'rare',
  albert_einstein: 'rare', carl_gauss: 'rare',
  // Uncommon (11)
  nicolas_darvas: 'uncommon', linda_raschke: 'uncommon',
  machiavelli: 'uncommon', arthur_hayes: 'uncommon',
  victor_sperandeo: 'uncommon', larry_williams: 'uncommon',
  zong_qinghou: 'uncommon', shen_wansan: 'uncommon',
  zhang_jian: 'uncommon', andre_cronje: 'uncommon',
  xu_mingxing: 'uncommon',
  // Common (1)
  william_oneil: 'common',
}

// Ghost Warnings — cautionary figures, NOT guardians
export const GHOST_WARNINGS = [
  { id: 'sbf', name: 'Sam Bankman-Fried', trigger: 'missing_risk_controls', quote: 'I used to think risk management was optional too.' },
  { id: 'do_kwon', name: 'Do Kwon', trigger: 'arrogance', quote: "I don't debate the poor." },
  { id: 'su_zhu', name: 'Su Zhu / 3AC', trigger: 'excessive_leverage', quote: 'The supercycle never ends.' },
  { id: 'newton_ghost', name: 'Isaac Newton (Ghost)', trigger: 'fomo_buying', quote: 'I can calculate the motion of heavenly bodies, but not the madness of people.' },
  { id: 'ltcm', name: 'Long-Term Capital Management', trigger: 'correlation_collapse', quote: "We thought diversification would save us. It didn't." },
  { id: 'lehman', name: 'Lehman Brothers', trigger: 'cascade_liquidation', quote: 'The music stopped. We were still dancing.' },
  { id: 'enron', name: 'Enron', trigger: 'concentrated_loser', quote: 'We believed our own story too deeply.' },
  { id: 'svb', name: 'Silicon Valley Bank', trigger: 'duration_mismatch', quote: 'We held too long, hoping the rates would turn.' },
] as const

// Eyes kept — universal across all masters
export const EYES = ['·', '✦', '×', '◉', '@', '°'] as const
export type Eye = (typeof EYES)[number]

// Hats replaced with master emblems
export const EMBLEMS = [
  'none',
  '📈',  // chart (traders)
  '⚖️',  // scales (value investors)
  '🔢',  // numbers (quants)
  '⚔️',  // sword (strategists)
  '🧠',  // brain (philosophers)
  '₿',   // bitcoin (crypto)
  '🔬',  // microscope (scientists)
] as const
export type Emblem = (typeof EMBLEMS)[number]
// Backward compat
export type Hat = Emblem
export const HATS = EMBLEMS

// Stats renamed for trading context
export const STAT_NAMES = [
  'PRECISION',    // was DEBUGGING — technical analysis accuracy
  'PATIENCE',     // unchanged — waiting for confirmation
  'AGGRESSION',   // was CHAOS — position sizing / leverage tolerance
  'WISDOM',       // unchanged — risk awareness
  'SASS',         // was SNARK — alert personality sharpness
] as const
export type StatName = (typeof STAT_NAMES)[number]

// Deterministic parts — derived from hash(userId)
export type CompanionBones = {
  rarity: Rarity
  species: Master  // backward compat field name
  eye: Eye
  hat: Emblem
  shiny: boolean
  stats: Record<StatName, number>
}

// Model-generated soul — for masters, pre-defined from historical identity
export type CompanionSoul = {
  name: string
  personality: string
}

export type Companion = CompanionBones &
  CompanionSoul & {
    hatchedAt: number
  }

export type StoredCompanion = CompanionSoul & { hatchedAt: number }

export const RARITY_WEIGHTS = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
} as const satisfies Record<Rarity, number>

export const RARITY_STARS = {
  common: '★',
  uncommon: '★★',
  rare: '★★★',
  epic: '★★★★',
  legendary: '★★★★★',
} as const satisfies Record<Rarity, string>

export const RARITY_COLORS = {
  common: 'inactive',
  uncommon: 'success',
  rare: 'permission',
  epic: 'autoAccept',
  legendary: 'warning',
} as const satisfies Record<Rarity, keyof import('../utils/theme.js').Theme>

// Re-export PatternType from diary for convenience
export type { PatternType } from './diary.js'
