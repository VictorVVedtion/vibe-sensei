/**
 * Options ghost warning definitions — cautionary apparitions from options trading disasters.
 */

export const OPTIONS_GHOST_WARNINGS = [
  {
    id: 'nick_leeson',
    name: 'Nick Leeson / Barings Bank',
    trigger: 'naked_options',
    quote: 'I thought I could trade my way out. The market had other plans.',
  },
  {
    id: 'option_sellers',
    name: 'OptionSellers.com (James Cordier)',
    trigger: 'short_volatility',
    quote: 'I sold volatility for years. Then volatility came to collect.',
  },
] as const
