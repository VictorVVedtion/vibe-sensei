import type { Command } from '../../commands.js'

const backtest = {
  type: 'local-jsx',
  name: 'backtest',
  description: 'Backtest 68 guardian strategies — /backtest soros, /backtest 凉兮, or /backtest to list all',
  argumentHint: '<strategy>',
  load: () => import('./backtest.js'),
} satisfies Command

export default backtest
