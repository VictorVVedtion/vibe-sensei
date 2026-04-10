/**
 * Demo provider — returns canned responses for zero-key demo mode.
 *
 * No API calls are made. The provider pattern-matches on the last user
 * message to return contextually appropriate responses that showcase
 * the guardian system, trading tools, and ghost warnings.
 */

import type { UUID } from 'crypto'
import type {
  AssistantMessage,
  StreamEvent,
  SystemAPIErrorMessage,
} from '../../../types/message.js'
import type {
  ProviderClient,
  ProviderInfo,
  ProviderQueryParams,
} from './types.js'

// ---------------------------------------------------------------------------
// Canned response catalog
// ---------------------------------------------------------------------------

type CannedResponse = {
  /** Regex to match against the last user message text */
  match: RegExp
  /** Response text OR tool_use block */
  response: string | ToolUseResponse
}

type ToolUseResponse = {
  toolName: string
  toolInput: Record<string, unknown>
}

const DEMO_GREETING = `Welcome to **Vibe Sensei** demo mode! 🐙

Your guardian master has been assigned: **Warren Buffett** (Legendary).
He'll watch every trade you make and warn you when you're about to do something foolish.

Try these commands to see the system in action:
- \`/buy BTC 50000\` — place an oversized trade (watch the guardian react)
- \`/positions\` — check your open positions
- \`/balance\` — view your paper trading balance
- \`/master\` — see your guardian's profile
- \`/consult jesse_livermore "should I go long BTC?"\` — ask another master
- \`/debate "Is BTC going to 200k?"\` — watch two masters argue

This is paper trading with 100K USDT. No real money. No API key needed.`

const DEMO_RESPONSES: CannedResponse[] = [
  // Trading actions — use tool_use so the real tool pipeline fires
  {
    match: /(?:\/)?(?:buy|long)\s+(\w+)\s*([\d.]*)/i,
    response: {
      toolName: 'PlaceOrder',
      toolInput: { symbol: 'BTC/USDT', side: 'buy', type: 'market', quantity: 0.5 },
    },
  },
  {
    match: /(?:\/)?(?:sell|short)\s+(\w+)\s*([\d.]*)/i,
    response: {
      toolName: 'PlaceOrder',
      toolInput: { symbol: 'BTC/USDT', side: 'sell', type: 'market', quantity: 0.1 },
    },
  },
  {
    match: /(?:\/)?positions|open positions|my positions/i,
    response: {
      toolName: 'GetPositions',
      toolInput: {},
    },
  },
  {
    match: /(?:\/)?balance|my balance|portfolio/i,
    response: {
      toolName: 'GetBalance',
      toolInput: {},
    },
  },

  // Master / guardian queries
  {
    match: /(?:\/)?consult\s+(\w+)/i,
    response: `**Jesse Livermore** steps forward from the shadows...

*"The market is never wrong — opinions often are. If you're asking whether to go long, you've already decided. The question is: where's your stop?"*

**Risk Assessment:** BTC is showing momentum but your position sizing matters more than direction. A 2% portfolio risk per trade is the ceiling — anything above that and you're gambling, not trading.

*"There is nothing new in Wall Street. There can't be because speculation is as old as the hills."*`,
  },
  {
    match: /(?:\/)?debate|masters? argue|masters? debate/i,
    response: `## ⚔️ Master Debate: "Is BTC going to 200k?"

**🟢 FOR — George Soros** (Legendary, Macro Maverick)
*"The trend is your friend until the end. Reflexivity is driving institutional adoption — the more institutions buy, the more others follow. This is a self-reinforcing cycle. 200k is not a ceiling, it's a waypoint."*

**🔴 AGAINST — Benjamin Graham** (Legendary, Value Sage)
*"Price is what you pay, value is what you get. At these levels, where is the margin of safety? An asset with no cash flows, no dividends, and no intrinsic floor is speculation, not investment. Mr. Market is euphoric — that's precisely when you should be cautious."*

**⚖️ Synthesis:** Both masters agree on one thing — position sizing is paramount. Whether BTC reaches 200k or corrects 50%, your survival depends on risk management, not prediction.`,
  },
  {
    match: /(?:\/)?master|my guardian|who.*guardian|assigned master/i,
    response: `**Your Guardian: Warren Buffett** ★★★★★ Legendary

*"Be fearful when others are greedy, and greedy when others are fearful."*

Archetype: Value Sage
Stats: PRECISION 92 · PATIENCE 98 · AGGRESSION 15 · WISDOM 95 · SASS 60

Warren is watching your trades. He doesn't like leverage, hates day-trading, and will remind you that time in the market beats timing the market.`,
  },

  // Backtest
  {
    match: /backtest|liangxi|凉兮|rolling.?position|滚仓/i,
    response: `## ⚡ /backtest liangxi — 凉兮 Rolling Position Strategy

**519 Crash · BTC/USDT 5m · May 17-25, 2021 · 1000 USDT · 100x SHORT**

\`\`\`
Equity (log)
 $1M │                          ███ ← PEAK $985,261 (985x)
     │                       ███
     │                    ███ ░
100K │                 ███  ░░
     │              ███     ░░░
     │           ███       ░░░░░░░░░░░░░░░░░░░ ← SURVIVED $19,976 (40x)
 10K │        ███          ░
     │     ███
     │  ███
  1K │██░
     │                                        █
   0 │────────────────────────────────────────████████████████████
     └──────────────────────────────────────────────────────────
     May 17        May 18        May 19 (519)     May 20-25

     █ Raw 凉兮 (无风控)     ░ 凉兮 + Vibe Sensei Guardian
\`\`\`

| Strategy | Peak | Final | Trades | Wins | Liquidations |
|----------|------|-------|--------|------|-------------|
| **Raw 凉兮 (无风控)** | $985K (985x) | **$0** | 18 | 17 | **1** |
| **凉兮 + Guardian** | $40K (40x) | **$19,976** | 67 | 35 | **0** |

**💀 Raw: peaked at 985x then LIQUIDATED to $0**
**🛡️ Guardian: SURVIVED at 40x — $19,976 preserved, 0 liquidations**

> *"爆仓线就是我的加仓信号。" — 凉兮*

The rolling position technique compounds exponentially during unidirectional crashes — each take-profit re-enters with accumulated capital at full leverage. Without risk management, the inevitable rebound is fatal. The Guardian's 0.3% stop-loss and circuit breaker preserve 40x of the peak gain.`,
  },

  // Ghost warning trigger
  {
    match: /leverage|100x|50x|yolo|all.?in|max/i,
    response: `⚠️ Your guardian **Warren Buffett** is alarmed:
*"Only when the tide goes out do you discover who's been swimming naked. You're about to find out."*

👻 **GHOST WARNING — SBF appears...**
*"I too thought I was the smartest person in the room. I too thought leverage was just a number. Look where that got me. Your '100x conviction play' is my Chapter 11 filing with extra steps."*

The ghost fades, leaving behind the faint smell of Bahamas saltwater and bad decisions.

**Risk Guardian says:** Position rejected. Maximum recommended leverage is 3x for paper mode.`,
  },

  // Help / general
  {
    match: /help|what can|how do|tutorial/i,
    response: `**Vibe Sensei Demo Mode** — here's what you can try:

| Command | What it does |
|---------|-------------|
| \`/buy BTC 1000\` | Buy BTC with your paper balance |
| \`/sell BTC 0.5\` | Sell BTC |
| \`/positions\` | View open positions with P&L |
| \`/balance\` | Check your 100K USDT balance |
| \`/master\` | Meet your guardian (Warren Buffett) |
| \`/consult soros "market outlook"\` | Get a second opinion |
| \`/debate "should I short ETH?"\` | Watch masters argue |
| \`try "100x leverage on BTC"\` | Trigger a ghost warning |
| \`/summon\` | Re-play the summoning ceremony |

Your guardian watches every trade. Ghost warnings appear when you do something dangerous. This is a zero-risk sandbox.`,
  },
]

// ---------------------------------------------------------------------------
// Fallback response
// ---------------------------------------------------------------------------

const FALLBACK_RESPONSE = `I hear you. In demo mode, I can help you explore the guardian system:

- **Trade**: \`/buy BTC 1000\` or \`/sell ETH 0.5\`
- **Check**: \`/positions\`, \`/balance\`
- **Consult**: \`/consult jesse_livermore "what do you think?"\`
- **Debate**: \`/debate "BTC bull or bear?"\`

Your guardian **Warren Buffett** is watching. Try something bold — he'll let you know if it's foolish.`

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

function makeUUID(): UUID {
  return crypto.randomUUID() as UUID
}

function makeAssistantMessage(text: string): AssistantMessage {
  return {
    type: 'assistant',
    uuid: makeUUID(),
    message: {
      role: 'assistant',
      id: `demo_${Date.now()}`,
      content: [{ type: 'text', text }],
      usage: {
        input_tokens: 0,
        output_tokens: text.length,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      model: 'demo-mode',
      stop_reason: 'end_turn',
    },
  } as AssistantMessage
}

function makeToolUseMessage(toolName: string, toolInput: Record<string, unknown>): AssistantMessage {
  const toolUseId = `toolu_demo_${Date.now()}`
  return {
    type: 'assistant',
    uuid: makeUUID(),
    message: {
      role: 'assistant',
      id: `demo_${Date.now()}`,
      content: [
        {
          type: 'tool_use',
          id: toolUseId,
          name: toolName,
          input: toolInput,
        },
      ],
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      model: 'demo-mode',
      stop_reason: 'tool_use',
    },
  } as AssistantMessage
}

function extractLastUserText(params: ProviderQueryParams): string {
  const messages = params.messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!
    if (msg.message?.role === 'user') {
      const content = msg.message.content
      if (typeof content === 'string') return content
      if (Array.isArray(content)) {
        for (const block of content) {
          if (typeof block === 'object' && 'type' in block && block.type === 'text' && 'text' in block) {
            return (block as { text: string }).text
          }
        }
      }
    }
  }
  return ''
}

// ---------------------------------------------------------------------------
// DemoProvider
// ---------------------------------------------------------------------------

let isFirstMessage = true

export class DemoProvider implements ProviderClient {
  readonly id = 'demo'

  async *streamQuery(
    params: ProviderQueryParams,
  ): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void> {
    const userText = extractLastUserText(params)

    // First message in session → show greeting (only if user didn't type a command)
    if (isFirstMessage) {
      isFirstMessage = false
      // Check if user typed a recognizable command — if so, skip greeting
      const hasMatch = DEMO_RESPONSES.some(c => c.match.test(userText))
      if (!hasMatch && (!userText || userText.length < 3)) {
        yield makeAssistantMessage(DEMO_GREETING)
        return
      }
    }

    // Check canned responses
    for (const canned of DEMO_RESPONSES) {
      if (canned.match.test(userText)) {
        if (typeof canned.response === 'string') {
          yield makeAssistantMessage(canned.response)
        } else {
          // Parse dynamic values from user input for trading tools
          const response = canned.response as ToolUseResponse
          const input = { ...response.toolInput }

          // Try to extract symbol and quantity from user text
          const tradeMatch = userText.match(/(?:buy|sell|long|short)\s+(\w+)\s*([\d.]*)/i)
          if (tradeMatch) {
            input.symbol = `${tradeMatch[1]!.toUpperCase()}/USDT`
            if (tradeMatch[2]) {
              input.quantity = parseFloat(tradeMatch[2])
            }
          }

          yield makeToolUseMessage(response.toolName, input)
        }
        return
      }
    }

    // Fallback
    yield makeAssistantMessage(FALLBACK_RESPONSE)
  }

  async query(params: ProviderQueryParams): Promise<AssistantMessage> {
    const userText = extractLastUserText(params)
    for (const canned of DEMO_RESPONSES) {
      if (canned.match.test(userText) && typeof canned.response === 'string') {
        return makeAssistantMessage(canned.response)
      }
    }
    return makeAssistantMessage(FALLBACK_RESPONSE)
  }

  async verifyCredentials(): Promise<boolean> {
    return true
  }

  getInfo(): ProviderInfo {
    return {
      id: 'demo',
      name: 'Demo',
      description: 'Zero-key demo mode with canned responses',
      baseUrl: '',
      models: [],
      authEnvVars: [],
      supportsThinking: false,
      supportsTools: true,
      streamingMode: 'none',
    }
  }
}
