# Next Session Context — Vibe Sensei

## What Is This
AI 交易终端，fork 自 Claude Code 框架。52 个历史大师守护者 + 4 个幽灵警告。深海绿克苏鲁章鱼 logo。

## Current State (截至 2026-04-02)

**全部 40/40 sprints 已 MERGED — v0.2.1 完整交付**

Phase 0 (Core Trading): Sprints 1-4 ✅
Phase 1 (Guardians): Sprints 5-8 ✅
Phase 2 (Web + Polish): Sprints 9-12 ✅
Phase 3 (Integration): Sprints 13-16 ✅
Phase 4 (Docs + Cleanup): Sprints 17-20 ✅
Phase 5 (Advanced): Sprints 21-24 ✅
Phase 6 (Performance): Sprints 25-28 ✅
Phase 7 (Desktop App): Sprints 29-34 ✅
Phase 8 (Desktop Hardening): Sprints 35-40 ✅

## Phase 8 成果 (Post-Review Fixes)
- Build 流水线修复: esbuild 编译 main process TS→JS (Sprint 35)
- PTY 崩溃恢复: 退出检测 + 指数退避重启 + 进程组清理 + 错误 UI (Sprint 36)
- IPC 桥接 Part 1: Bun→Electron JSONL 临时文件协议 (Sprint 37)
- IPC 桥接 Part 2: 真实 guardian 数据 + 移除所有占位数据 (Sprint 38)
- 竞态修复 + IPC 验证: PTY 就绪握手 + Zod schema + Error Boundary (Sprint 39)
- 无障碍 + 测试: Tab 导航 + ARIA + 色盲指示 + vitest (22 测试) (Sprint 40)

## 启动方式
- `bun run dev` — REPL (终端)
- `bun run dev -- --web` — REPL + TradingView 图表 (:3456)
- `bun run desktop:dev` — Electron 桌面版 (开发模式)
- `bun run desktop:build mac` — macOS DMG 安装包

## Desktop 架构
```
Electron Main → PTY Manager → Bun REPL (子进程)
             → IPC Router  → Renderer (Terminal + Chart + Guardian Sidebar)
             → Desktop Bridge (JSONL file protocol) ← Bun trading engine
```

## Bundle: 27MB (从 37MB 优化)
## Desktop 文件数: 40 (含 22 个测试)

**Repo**: github.com/VictorVVedtion/vibe-sensei (private)
**Location**: ~/Desktop/vibe-sensei
