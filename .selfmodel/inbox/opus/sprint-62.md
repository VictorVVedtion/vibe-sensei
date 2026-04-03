# Sprint 62: Morning Brief + Knowledge Milestones

## Task
Create the Morning Brief (daily startup summary from wiki) and Knowledge Milestones (achievement system).

## Implementation Details

### 1. `src/services/knowledge/morning-brief.ts`
- `generateMorningBrief(): Promise<string | null>` — generate a 5-line personalized briefing
- Check last-brief-date in `~/.vibe-sensei/.last-brief-date`. If today, return null.
- Read wiki INDEX.md and key articles (self/profile.md, patterns/overview.md, self/advice-accuracy.md)
- Content: current market regime + user's historical win rate in that regime, top behavioral pattern reminder, discipline streak count, advice accuracy highlight
- Format in Guardian's personality voice (import buildGuardianSystemPrompt from persona.ts, use master's archetype)
- If wiki doesn't exist, return null (graceful degradation)
- Write today's date to `.last-brief-date` after successful generation
- Use Gemini 2.5 Flash for personalized voice (or template if no API key)

### 2. `src/services/knowledge/milestones.ts`
- Define milestone thresholds:
  - Event count: 10, 50, 100, 250, 500
  - Discipline streaks: 7, 14, 30 days (consecutive days following stop-loss advice)
  - First pattern discovery
  - First wiki compile
  - First month of data
- `checkMilestones(): MilestoneResult[]` — check which milestones are newly achieved
- Store achieved milestones in `~/.vibe-sensei/.milestones.json`
- Format milestone celebration in Guardian's voice
- Return array of newly achieved milestones

### 3. Integration
- Wire Morning Brief into REPL startup (or main.tsx initialization):
  - After REPL renders, check if brief should show
  - Display via companionReaction or direct console output
- Wire Milestones into event-store:
  - After appendEvent, check milestone thresholds periodically (not every event — every 10th event)
  - Newly achieved milestones → companionReaction notification

### 4. Data sources
- `getWikiHealthScore()` from auditor.ts (Sprint 61) for coverage/freshness
- `readEvents()` from event-store.ts for event counts
- `getAdviceAccuracy()` from counterfactual.ts (Sprint 58) for accuracy stats
- Wiki articles (INDEX.md, self/profile.md) for pattern summaries

Run `bun run build` to verify.
