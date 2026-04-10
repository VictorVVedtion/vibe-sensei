/**
 * /backtest <guardian> — Run any of the 68 guardian backtests.
 *
 * Each guardian is mapped to their signature historical event with
 * hand-curated strategy parameters. Equity curves compare raw
 * (no risk management) vs guardian-enhanced trading.
 *
 * Usage:
 *   /backtest liangxi       — 519 crash rolling positions
 *   /backtest soros          — 1992 Black Wednesday
 *   /backtest burry          — 2008 Big Short
 *   /backtest satoshi         — Genesis to $100K
 *   /backtest                — list all 68 strategies
 */

import * as React from 'react'
import { useEffect, useMemo } from 'react'
import { Box, Text, useInput } from '../../ink.js'
import type { LocalJSXCommandCall } from '../../types/command.js'
import type { ChartSegment } from '../../components/CandlestickChart/types.js'
import { renderEquityChart } from './render-equity.js'
import { resolveStrategy, getStrategy, listStrategies } from './strategies.js'

// ─── Segment helper ─────────────────────────────────────────────────

function ChartLines({ lines }: { lines: ChartSegment[][] }) {
  return (
    <>
      {lines.map((segs, i) => (
        <Text key={i}>
          {segs.map((s, j) => (
            <Text key={j} color={s.color as any} dimColor={s.dim}>{s.text}</Text>
          ))}
        </Text>
      ))}
    </>
  )
}

// ─── Strategy List Screen ───────────────────────────────────────────

function StrategyListScreen({ onDone }: { onDone: () => void }) {
  useInput(() => onDone())
  useEffect(() => {
    const t = setTimeout(() => onDone(), 120_000)
    return () => clearTimeout(t)
  }, [onDone])

  const strategies = listStrategies()

  // Group by category
  const categories = [
    { label: 'Western Trading Legends', keys: ['jesse_livermore', 'george_soros', 'paul_tudor_jones', 'stanley_druckenmiller', 'michael_burry', 'john_paulson', 'nicolas_darvas'] },
    { label: 'Value Investing Sages', keys: ['warren_buffett', 'benjamin_graham', 'charlie_munger', 'ray_dalio', 'john_templeton'] },
    { label: 'Quant Pioneers', keys: ['jim_simons', 'ed_thorp', 'richard_dennis', 'linda_raschke'] },
    { label: 'Eastern Strategists', keys: ['sun_tzu', 'munehisa_homma', 'fan_li', 'miyamoto_musashi', 'lv_buwei'] },
    { label: 'Philosophers of Risk', keys: ['nassim_taleb', 'seneca', 'laozi', 'machiavelli'] },
    { label: 'Crypto Era', keys: ['satoshi_nakamoto', 'arthur_hayes'] },
    { label: 'Tactical/Specialist', keys: ['william_oneil', 'victor_sperandeo', 'larry_williams'] },
    { label: 'Tech Visionaries', keys: ['elon_musk', 'jeff_bezos', 'peter_thiel', 'steve_jobs', 'richard_feynman', 'garry_tan', 'andrej_karpathy'] },
    { label: 'Chinese Legends', keys: ['li_ka_shing', 'hu_xueyan', 'zong_qinghou', 'zeng_guofan', 'bai_gui', 'shen_wansan', 'zhang_jian'] },
    { label: 'Crypto/Web3', keys: ['vitalik_buterin', 'cz_zhao', 'andre_cronje', 'he_yi', 'xu_mingxing', 'justin_sun', 'brian_armstrong', 'barry_silbert', 'michael_saylor'] },
    { label: 'Degen + Cautionary', keys: ['liangxi', 'do_kwon', 'su_zhu', 'sbf', 'kyle_davies'] },
    { label: 'Macro/Regulators', keys: ['powell', 'yellen', 'gary_gensler', 'cathie_wood'] },
    { label: 'Scientists', keys: ['isaac_newton', 'albert_einstein', 'alan_turing', 'carl_gauss', 'benoit_mandelbrot', 'claude_shannon', 'john_von_neumann'] },
  ]

  const strategyMap = new Map(strategies.map(s => [s.key, s]))

  return (
    <Box flexDirection="column" paddingX={2}>
      <Text bold color="green">{`/backtest — 68 Guardian Strategies`}</Text>
      <Text dimColor>{'─'.repeat(70)}</Text>
      {categories.map(cat => (
        <Box key={cat.label} flexDirection="column" marginTop={0}>
          <Text color="cyan" bold>{`  ${cat.label}`}</Text>
          {cat.keys.map(key => {
            const s = strategyMap.get(key as any)
            if (!s) return null
            return (
              <Text key={key} dimColor>
                {`    /backtest ${key.padEnd(22)} ${s.event}`}
              </Text>
            )
          })}
        </Box>
      ))}
      <Text dimColor>{'\n  Aliases: soros, burry, ptj, druck, satoshi, 凉兮, 孙子, 老子, cz, ...'}</Text>
      <Text dimColor>[press any key to dismiss]</Text>
    </Box>
  )
}

// ─── Backtest Screen ────────────────────────────────────────────────

function BacktestScreen({ onDone, args }: { onDone: () => void; args: string }) {
  useInput(() => onDone())
  useEffect(() => {
    const t = setTimeout(() => onDone(), 60_000)
    return () => clearTimeout(t)
  }, [onDone])

  const strategy = (args || '').trim()

  // No args → show strategy list
  if (!strategy) {
    return <StrategyListScreen onDone={onDone} />
  }

  // Resolve strategy name
  const masterKey = resolveStrategy(strategy)
  if (!masterKey) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Text color="yellow">Unknown strategy: {strategy}</Text>
        <Text dimColor>Run /backtest with no args to see all 68 strategies.</Text>
        <Text dimColor>[press any key to dismiss]</Text>
      </Box>
    )
  }

  const data = getStrategy(masterKey)
  if (!data) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Text color="yellow">Strategy data not found for: {masterKey}</Text>
        <Text dimColor>[press any key to dismiss]</Text>
      </Box>
    )
  }

  const chartLines = useMemo(() => renderEquityChart(
    [
      { label: data.rawLabel, values: data.rawCurve, color: 'green', char: '█' },
      { label: data.grdLabel, values: data.grdCurve, color: 'cyan', char: '█' },
    ],
    {
      width: 90,
      height: 18,
      title: `/backtest ${masterKey}`,
      subtitle: data.subtitle,
      timeLabels: data.timeLabels,
    },
  ), [masterKey])

  const r = data.raw
  const g = data.guardian

  const fmtPeak = (v: number) => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`
  const fmtFinal = (v: number) => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `$${v.toLocaleString()}` : `$${v}`

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" paddingX={1}>
        <ChartLines lines={chartLines} />
      </Box>

      {/* Stats table */}
      <Box flexDirection="column" paddingX={2} marginTop={1}>
        <Text dimColor>{'┌──────────────────────┬──────────┬─────────┬────────┬──────┬──────┐'}</Text>
        <Text dimColor>{'│ Strategy             │ Peak     │ Final   │ Trades │ Wins │ Liqs │'}</Text>
        <Text dimColor>{'├──────────────────────┼──────────┼─────────┼────────┼──────┼──────┤'}</Text>
        <Text>
          <Text dimColor>│ </Text><Text color="green">{`Raw ${data.name}`.slice(0, 20).padEnd(20)}</Text>
          <Text dimColor>│ </Text><Text color="green">{fmtPeak(r.peak).padEnd(8)}</Text>
          <Text dimColor>│ </Text><Text color={r.final > 0 ? 'green' : 'red'} bold>{(r.final > 0 ? fmtFinal(r.final) : '$0').padEnd(7)}</Text>
          <Text dimColor>│ </Text><Text>{String(r.trades).padEnd(6)}</Text>
          <Text dimColor>│ </Text><Text>{String(r.wins).padEnd(4)}</Text>
          <Text dimColor>│ </Text><Text color={r.liqs > 0 ? 'red' : 'green'}>{String(r.liqs).padEnd(4)}</Text>
          <Text dimColor>│</Text>
        </Text>
        <Text>
          <Text dimColor>│ </Text><Text color="cyan">{`+ Guardian`.padEnd(20)}</Text>
          <Text dimColor>│ </Text><Text color="cyan">{fmtPeak(g.peak).padEnd(8)}</Text>
          <Text dimColor>│ </Text><Text color="green" bold>{fmtFinal(g.final).padEnd(7)}</Text>
          <Text dimColor>│ </Text><Text>{String(g.trades).padEnd(6)}</Text>
          <Text dimColor>│ </Text><Text>{String(g.wins).padEnd(4)}</Text>
          <Text dimColor>│ </Text><Text color="green">{String(g.liqs).padEnd(4)}</Text>
          <Text dimColor>│</Text>
        </Text>
        <Text dimColor>{'└──────────────────────┴──────────┴─────────┴────────┴──────┴──────┘'}</Text>
      </Box>

      <Box paddingX={2} marginTop={1}>
        <Text dimColor italic>{`"${data.quote}" — ${data.name}`}</Text>
      </Box>
      <Box paddingX={2}>
        <Text dimColor>[press any key to dismiss]</Text>
      </Box>
    </Box>
  )
}

// ─── Export ──────────────────────────────────────────────────────────

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  return <BacktestScreen onDone={() => onDone('Backtest shown.', { display: 'system' })} args={args} />
}
