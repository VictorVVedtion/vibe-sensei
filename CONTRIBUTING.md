# Contributing to Vibe Sensei

Welcome! Vibe Sensei has 68 guardian masters and room for many more. The single best first contribution is to **add a new master** or **draw sprites** for one of the 14 masters still missing PNG art.

## Quick Start

```bash
git clone https://github.com/VictorVVedtion/vibe-sensei.git
cd vibe-sensei
bun install
bun run dev          # interactive REPL
bun run build        # the only required check before submitting a PR
```

---

## Add a Master (Best First PR)

Branch: `add-master/your_master_name` -- PR title: `feat(buddy): add master -- Display Name`

### 1. Add to the roster -- `src/buddy/types.ts`

Four additions in one file. Use `snake_case` keys:

```ts
// MASTERS array -- pick the right category section
'ada_lovelace',      // R -- computation pioneer

// MASTER_NAMES
ada_lovelace: 'Ada Lovelace',

// MASTER_QUOTES -- one iconic line, native language welcome
ada_lovelace: 'The Analytical Engine weaves algebraical patterns just as the Jacquard loom weaves flowers and leaves.',

// MASTER_RARITY
ada_lovelace: 'rare',
```

**Rarity guide** (current counts: 8L / 18E / 22R / 20U / 1C):

| Tier | Bar |
|------|-----|
| Legendary | Changed how markets or humanity work forever |
| Epic | Iconic, lasting influence on trading philosophy |
| Rare | Significant historical figure with trading relevance |
| Uncommon | Notable figure with a specific trading lesson |
| Common | Solid practitioner with a teachable framework |

### 2. Assign archetype -- `src/buddy/persona.ts`

Add one entry to `MASTER_ARCHETYPE_MAP`. Nine archetypes exist:

```
value_investor  trend_follower  macro_trader  quant  strategist
philosopher     first_principles  crypto_native  scientist
```

```ts
ada_lovelace: 'scientist',
```

Stats (PRECISION, PATIENCE, AGGRESSION, WISDOM, SASS -- each 0-100) are generated from the user's ID hash. You do not set them.

### 3. Add ASCII portrait -- `src/buddy/sprite-atlas.ts`

Three lines of ASCII art, max 17 display chars each. No emoji inside portraits.

```ts
ada_lovelace: {
  portrait: [
    '  ╱▓▓▓▓▓╲   ',
    '  (◉    ◉)  ',
    '   ╰─‿─╯    ',
  ],
  compactFace: '◉‿◉',
  eyeChars: ['◉'],
  emotions: {
    happy:   ['  ╱▓▓▓▓▓╲   ', '  (●    ●)  ', '   ╰─︶─╯    '],
    worried: ['  ╱▓▓▓▓▓╲   ', '  (·    ·)  ', '   ╰─~─╯    '],
  },
},
```

Emotion tiers: Legendary=4, Epic=3, Rare=2, Uncommon/Common=eyeChars only.

### 4. Add PNG sprites (optional) -- `assets/sprites/`

Six files, 256x256 px, transparent background, pixel-art style:

```
ada_lovelace-idle.png       ada_lovelace-active.png
ada_lovelace-happy.png      ada_lovelace-worried.png
ada_lovelace-alert.png      ada_lovelace-celebrate.png
```

See `assets/sprites/cz_zhao-idle.png` for style reference.

### 5. Update counts

Bump the master count in `README.md`, `package.json` description, and `CLAUDE.md`.

### 6. Verify

```bash
bun run build   # must succeed
```

---

## Draw Sprites for Existing Masters (Artist PRs)

These 14 masters have ASCII portraits but no PNG art yet. Each needs 6 emotion PNGs. No code changes required -- just drop files into `assets/sprites/` and open a PR.

| Key | Name | Category |
|-----|------|----------|
| `jeff_bezos` | Jeff Bezos | Tech Visionary |
| `peter_thiel` | Peter Thiel | Tech Visionary |
| `steve_jobs` | Steve Jobs | Tech Visionary |
| `richard_feynman` | Richard Feynman | Scientist |
| `garry_tan` | Garry Tan | Tech Visionary |
| `andrej_karpathy` | Andrej Karpathy | Tech Visionary |
| `li_ka_shing` | Li Ka-shing | Chinese Business Legend |
| `hu_xueyan` | Hu Xueyan | Chinese Business Legend |
| `zong_qinghou` | Zong Qinghou | Chinese Business Legend |
| `zeng_guofan` | Zeng Guofan | Chinese Business Legend |
| `bai_gui` | Bai Gui | Chinese Business Legend |
| `shen_wansan` | Shen Wansan | Chinese Business Legend |
| `andre_cronje` | Andre Cronje | Crypto/Web3 |
| `he_yi` | He Yi | Crypto/Web3 |

PR title: `art(sprites): add PNGs for <master_name>`

---

## Other Contributions

### Ghost Warnings

Cautionary apparitions triggered by dangerous patterns. Add an entry to `GHOST_WARNINGS` in `src/buddy/types.ts` and a persona in `src/buddy/ghost-warnings.ts`.

### Bug Reports and Feature Requests

Open an [issue](https://github.com/VictorVVedtion/vibe-sensei/issues). For bugs, include steps to reproduce. For features, explain the use case.

### Translations

Display names support bilingual format (e.g. `'CZ 赵长鹏'`, `'孙子 Sun Tzu'`). Quotes can be in the master's native language. Improvements welcome.

### Code Contributions

Follow existing patterns. Keep functions under 50 lines. No TODOs, no mocks, no empty catch blocks, no hardcoded secrets.

---

## Development Notes

- **Runtime**: Bun (not Node)
- **Build**: `bun run build` is the only required check
- **~1341 tsc errors** are legacy type issues -- they do not block the Bun runtime and you should not try to fix them all
- **No test runner or linter** is configured yet

## PR Checklist

- [ ] One logical change per PR
- [ ] `bun run build` passes
- [ ] Commit message explains *why*, not just *what*
- [ ] Related issues referenced

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
