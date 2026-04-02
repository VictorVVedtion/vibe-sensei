#!/usr/bin/env bash
# enforce-leader-worktree.sh — PreToolUse hook (matcher: Write|Edit)
# 强制执行「Leader 不下场」规则：白名单外的代码修改被拦截
# 从 stdin 读取 JSON，提取 tool_input.file_path 进行白名单检查
# exit 0 = 放行 | exit 2 = 拦截

set -euo pipefail

# ── 紧急绕过 ──
if [[ "${BYPASS_LEADER_RULES:-0}" == "1" ]]; then
    exit 0
fi

# ── jq 依赖检测：缺失时放行，绝不误拦截 ──
if ! command -v jq &>/dev/null; then
    exit 0
fi

# ── 读取 stdin ──
INPUT="$(cat)"
if [[ -z "${INPUT}" ]]; then
    exit 0
fi

# ── 提取文件路径 ──
FILE_PATH="$(printf '%s' "${INPUT}" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
if [[ -z "${FILE_PATH}" ]]; then
    # 无法提取路径（可能是非文件操作），放行
    exit 0
fi

# ── 白名单规则 ──
# 规范化路径：移除可能的前导 ./ 和绝对路径前缀
NORMALIZED="${FILE_PATH}"
# 去除绝对路径前缀（如果包含项目根路径）
NORMALIZED="${NORMALIZED#"${PWD}/"}"
# 去除前导 ./
NORMALIZED="${NORMALIZED#./}"

# 1. .selfmodel/ 目录（合约、inbox、state、playbook 等）
if [[ "${NORMALIZED}" == .selfmodel/* ]]; then
    exit 0
fi

# 2. .claude/ 目录（settings、watchdog 等）
if [[ "${NORMALIZED}" == .claude/* ]]; then
    exit 0
fi

# 3. scripts/ 目录（hook 脚本、工具脚本）
if [[ "${NORMALIZED}" == scripts/* ]]; then
    exit 0
fi

# 4. playbook/ 目录（规则文件）
if [[ "${NORMALIZED}" == playbook/* ]]; then
    exit 0
fi

# 5. 任何 .md 文件（Leader 可以写文档）
if [[ "${NORMALIZED}" == *.md ]]; then
    exit 0
fi

# 6. .gitignore
if [[ "${NORMALIZED}" == .gitignore ]]; then
    exit 0
fi

# ── 白名单外：拦截 ──
# 自动记录拦截事件到 lessons-learned（Auto-Learned 部分）
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] hook=enforce-leader-worktree target=$(basename "${FILE_PATH}") reason=outside-whitelist" \
  >> "${PROJECT_ROOT}/.selfmodel/state/hook-intercepts.log" 2>/dev/null || true

{
    echo "🚨 [Hook 拦截] 违反「Leader 不下场」规则"
    echo ""
    echo "被拦截文件: ${FILE_PATH}"
    echo ""
    echo "Leader 角色只负责编排、审查、仲裁，不直接修改业务代码。"
    echo "白名单范围: .selfmodel/、.claude/、scripts/、playbook/、*.md、.gitignore"
    echo ""
    echo "正确做法:"
    echo "  1. 在 .selfmodel/contracts/active/ 下创建 Sprint 合约"
    echo "  2. 在 .selfmodel/inbox/<agent>/ 下写入任务文件"
    echo "  3. 派遣 Agent（Gemini/Codex/Opus）到独立 worktree 中实现代码修改"
    echo ""
    echo "如需紧急绕过，使用: BYPASS_LEADER_RULES=1"
} >&2

exit 2
