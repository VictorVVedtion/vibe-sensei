# Changelog

All notable changes to Vibe Sensei will be documented in this file.

## [0.1.0.0] - 2026-04-04

### Added
- Guardian is now always visible on startup with a minimalist face + name display
- Idle quotes cycle every ~30 seconds, personalized by your guardian's archetype
- Context-aware idle quotes adapt to market regime, time of day, and your activity
- Time-aware greetings: morning, late-night, and weekend messages
- Guardian face color changes with market conditions (red for volatile, yellow for expanding)
- "Attentive" state: guardian briefly acknowledges your trades before returning to idle
- Idle care: guardian notices when you've been staring at the screen for 10+ minutes
- Live chart auto-refresh polls exchange data at timeframe-appropriate intervals
- Stale data indicator appears after 3 consecutive refresh failures with exponential backoff
- Volume spike highlighting: bars above 2x average volume render at full brightness
- Lightweight regime poller keeps market state warm for companion insights
- Primary symbol auto-detection from active positions or recent trades

### Changed
- Chart renderer rewritten from Braille subpixel to ASCII candlesticks for universal terminal compatibility
- Chart timestamps restored to UTC with explicit 'UTC' suffix
- Guardian display consolidated into a singleton to prevent duplicate timers in fullscreen mode
- Tick frequency adapts: 500ms during reactions, 5s during idle (90% fewer re-renders)
- Narrow terminals (<40 cols) show face only; very narrow (<20 cols) hide companion entirely

### Fixed
- Removed all `feature('BUDDY')` gates that kept the guardian invisible (6 locations)
- Desktop dev mode: build to CJS before Electron launch, fixing ESM/CJS conflicts
- Chart `colWidth` mismatch between component (was 1) and renderer (2) unified
- LiveChart generation ID prevents stale instances from polling after new charts open

### Removed
- Dead code cleanup: unused sprite animation constants, imports, and functions from CompanionSprite
