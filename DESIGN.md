# DESIGN.md -- Vibe Sensei Terminal Design System

## Philosophy
Matrix terminal. Phosphor green on black. Cold, precise, brutal.
Hacker aesthetic expressed through restraint, not decoration.

## Matrix Green Palette

| Token        | Usage                       | Ink Color Name | Hex Reference |
|--------------|-----------------------------|----------------|---------------|
| PRIMARY      | Main accent, active states  | green          | #00FF41       |
| BACKGROUND   | Main background             | -              | #0D1117       |
| UP/PROFIT    | Up / positive / success     | green          | #20C20E       |
| DOWN/LOSS    | Down / negative / danger    | red            | #FF003C       |
| DIM/MUTED    | Secondary text, labels      | green (dim)    | #008F11       |
| BORDER       | Panel borders, dividers     | -              | #002B0E       |
| FOREGROUND   | Default text color          | green          | #00FF41       |

Additional:
| WARNING      | Warning                     | yellow         | #FFEA00       |
| CRITICAL     | Emergencies                 | red            | #FF003C       |
| SELECTION    | Selection background        | -              | #004D1A       |
| SECONDARY_BG | Secondary background        | -              | #0A0F0A       |
| CARD_BG      | Card / control background   | -              | #0D150D       |

## Border Language
- Do not use border shape to distinguish rarity
- All borders use single line: top-left top-right bottom-left bottom-right horizontal vertical
- Rarity distinguished by color brightness:
  - Legendary: green (bright)
  - Epic: white
  - Rare: gray (standard)
  - Uncommon: gray (dim)
  - Common: gray (very dim)

Note: current codebase retains 3 border styles (double/rounded/single) for backward
compatibility and colorless-terminal fallback. This is intentional.

## Text Symbols (no emoji)
- Up:       [+] or triangle-up
- Down:     [-] or triangle-down
- Guardian: [*]
- Warning:  [!]
- Urgent:   [!!]
- Council:  >>
- Pass:     [OK]
- Fail:     [XX]
- Info:     [i]

## Message Type Visual Language
- Master dialogue:   rounded bubble (existing)
- System warning:    full-line inverse (no border)
- Ghost whisper:     dim green text, no border, italic feel (...text... - Name)
- Council conclusion: >> prefix indent
- Gate status:       inverse tag [OK] / [XX]

## Information Hierarchy
- P0: Candlestick chart / price / position PnL
- P1: Risk warning / gate status
- P2: Master dialogue / bubble
- P3: Octopus / master portrait (collapsed by default)
