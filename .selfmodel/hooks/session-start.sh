#!/usr/bin/env bash
# session-start.sh — SessionStart hook
# Session 启动时注入 team.json 和 next-session.md 上下文
# 输出内容会被 Claude Code 自动读取作为启动上下文
# 始终 exit 0，绝不阻断启动

set -euo pipefail

# 项目根目录（hook 从项目根运行）
PROJECT_ROOT="${PWD}"

TEAM_JSON="${PROJECT_ROOT}/.selfmodel/state/team.json"
NEXT_SESSION="${PROJECT_ROOT}/.selfmodel/state/next-session.md"

echo "═══════════════════════════════════════════════════"
echo "📋 Session Start — 自动上下文注入"
echo "═══════════════════════════════════════════════════"

# 注入 team.json
echo ""
echo "── Team State ──"
if [[ -f "${TEAM_JSON}" ]]; then
    cat "${TEAM_JSON}"
else
    echo "（team.json 不存在，跳过）"
fi

# 注入 next-session.md
echo ""
echo "── Next Session Handoff ──"
if [[ -f "${NEXT_SESSION}" ]]; then
    cat "${NEXT_SESSION}"
else
    echo "（next-session.md 不存在，跳过）"
fi

echo ""
echo "═══════════════════════════════════════════════════"

exit 0
