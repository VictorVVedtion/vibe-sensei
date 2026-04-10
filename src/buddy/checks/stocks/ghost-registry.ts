/**
 * Stock ghost warning definitions — cautionary apparitions from equities disasters.
 */

export const STOCK_GHOST_WARNINGS = [
  {
    id: 'worldcom',
    name: 'WorldCom',
    trigger: 'earnings_concentration',
    quote: 'We inflated our numbers until the numbers deflated us. $11 billion in fraud, and the stock went to zero.',
  },
  {
    id: 'bear_stearns',
    name: 'Bear Stearns',
    trigger: 'financial_concentration',
    quote: 'We were fine on Friday. By Monday the liquidity was gone. 85 years of history — two dollars a share.',
  },
] as const
