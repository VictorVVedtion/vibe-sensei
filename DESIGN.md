# DESIGN.md -- Vibe Sensei Terminal Design System

## Philosophy
Deep-sea nuclear submarine control room. Cold, precise, brutal.
Cthulhu mythos depth expressed through restraint, not decoration.

## Abyssal Palette (4-color system)

| Token        | Usage                       | Ink Color Name | Hex Reference |
|--------------|-----------------------------|----------------|---------------|
| abyss-up     | Up / positive / success     | cyan           | #00FFA3       |
| abyss-down   | Down / negative / danger    | magenta        | #8B008B       |
| abyss-dim    | Background / border / minor | gray           | #3B4252       |
| abyss-bright | Highlight / current price   | white          | #ECEFF4       |

Additional:
| abyss-warn   | Warning                     | yellow         | #EBCB8B       |
| abyss-ghost  | Ghost whisper               | gray (dim)     | #4C566A       |

## Border Language
- Do not use border shape to distinguish rarity
- All borders use single line: top-left top-right bottom-left bottom-right horizontal vertical
- Rarity distinguished by color brightness:
  - Legendary: cyan (bright)
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
- Ghost whisper:     dim gray text, no border, italic feel (...text... - Name)
- Council conclusion: >> prefix indent
- Gate status:       inverse tag [OK] / [XX]

## Information Hierarchy
- P0: Candlestick chart / price / position PnL
- P1: Risk warning / gate status
- P2: Master dialogue / bubble
- P3: Octopus / master portrait (collapsed by default)
