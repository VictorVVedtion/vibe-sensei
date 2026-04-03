# Next Session Context — Vibe Sensei

## What Is This
AI 交易终端，fork 自 Claude Code 框架。52 个历史大师守护者 + 8 个幽灵警告 (原 4 + 新增 LTCM/Lehman/Enron/SVB)。深海绿克苏鲁章鱼 logo。

## Current State (截至 2026-04-02)

**全部 48/48 sprints 已 MERGED — Phase 9 完整交付**

Phase 0 (Core Trading): Sprints 1-4 ✅
Phase 1 (Guardians): Sprints 5-8 ✅
Phase 2 (Web + Polish): Sprints 9-12 ✅
Phase 3 (Integration): Sprints 13-16 ✅
Phase 4 (Docs + Cleanup): Sprints 17-20 ✅
Phase 5 (Advanced): Sprints 21-24 ✅
Phase 6 (Performance): Sprints 25-28 ✅
Phase 7 (Desktop App): Sprints 29-34 ✅
Phase 8 (Desktop Hardening): Sprints 35-40 ✅
Phase 9 (LLM x Vibe Trading): Sprints 41-48 ✅

## Phase 9 新增功能 (LLM × Vibe Trading 融合)

### Tier 1 — Infrastructure
- Market Regime Engine: ATR(14) + HH/HL → 5 种 regime 分类 (Sprint 41)
- Portfolio Heat Calculator: 持仓风险聚合 → RiskGauge 实际数据 (Sprint 41)
- Dynamic Check Thresholds: 9 archetype × 4 check 动态阈值矩阵 (Sprint 42)
- Pre-Trade Gate: 9 项交易前门禁 (Sprint 43)
- ATR Stop-Loss Advisor + Circuit Breaker (Sprint 44)

### Tier 2 — Personalization
- Enhanced Diary: 6 新行为模式检测 (Sprint 45)
- Post-Trade R-Multiple Report (Sprint 46)
- Dynamic Guardian Prompts: 4 层上下文感知 (Sprint 47)
- Enhanced Ghost Triggers: 4 新金融幽灵 (Sprint 48)

## 启动方式
- `bun run dev` — REPL (终端)
- `bun run dev -- --web` — REPL + TradingView 图表 (:3456)
- `bun run desktop:dev` — Electron 桌面版 (开发模式)
- `bun run desktop:build` — 构建桌面安装包

**Repo**: github.com/VictorVVedtion/vibe-sensei (private)
**Location**: ~/Desktop/vibe-sensei
