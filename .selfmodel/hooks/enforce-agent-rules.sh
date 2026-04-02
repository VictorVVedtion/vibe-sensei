#!/usr/bin/env bash
# enforce-agent-rules.sh — PreToolUse hook (matcher: Bash)
# 强制执行「合约前置」和「Inbox 缓冲通信」规则
# 检测 gemini/codex 调用命令，确保有活跃合约和 inbox 任务文件
# exit 0 = 放行 | exit 2 = 拦截

set -euo pipefail

# ── 紧急绕过 ──
if [[ "${BYPASS_AGENT_RULES:-0}" == "1" ]]; then
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

# ── 提取 bash 命令 ──
COMMAND="$(printf '%s' "${INPUT}" | jq -r '.tool_input.command // empty' 2>/dev/null)"
if [[ -z "${COMMAND}" ]]; then
    exit 0
fi

# ── 检测是否为 agent 调用命令 ──
HAS_GEMINI=false
HAS_CODEX=false

# 使用 grep 进行大小写敏感匹配
if printf '%s' "${COMMAND}" | grep -q 'gemini'; then
    HAS_GEMINI=true
fi
if printf '%s' "${COMMAND}" | grep -q 'codex'; then
    HAS_CODEX=true
fi

# 不包含 agent 关键词的普通命令，直接放行
if [[ "${HAS_GEMINI}" == "false" && "${HAS_CODEX}" == "false" ]]; then
    exit 0
fi

# ── 合约前置检查 ──
# 检查 .selfmodel/contracts/active/ 下是否有至少一个 .md 文件
ACTIVE_CONTRACT_COUNT=0
if [[ -d ".selfmodel/contracts/active" ]]; then
    while IFS= read -r -d '' _; do
        ACTIVE_CONTRACT_COUNT=$((ACTIVE_CONTRACT_COUNT + 1))
    done < <(find .selfmodel/contracts/active -maxdepth 1 -name "*.md" -print0 2>/dev/null)
fi

if [[ "${ACTIVE_CONTRACT_COUNT}" -eq 0 ]]; then
    # 自动记录拦截事件到 lessons-learned（Auto-Learned 部分）
    PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] hook=enforce-agent-rules tool=$(printf '%s' "${COMMAND}" | awk '{print $1}') reason=no-active-contract" \
      >> "${PROJECT_ROOT}/.selfmodel/state/hook-intercepts.log" 2>/dev/null || true

    {
        echo "🚨 [Hook 拦截] 违反「Sprint 合约制」规则"
        echo ""
        echo "被拦截命令: ${COMMAND}"
        echo ""
        echo "调用 Agent 前必须有活跃的 Sprint 合约。"
        echo ""
        echo "正确做法:"
        echo "  1. 复制 .selfmodel/playbook/sprint-template.md 为模板"
        echo "  2. 在 .selfmodel/contracts/active/ 下创建合约文件"
        echo "  3. 填写目标、交付物、验收标准"
        echo "  4. 然后再调用 Agent"
        echo ""
        echo "如需紧急绕过，使用: BYPASS_AGENT_RULES=1"
    } >&2
    exit 2
fi

# ── Inbox 缓冲检查 ──
if [[ "${HAS_GEMINI}" == "true" ]]; then
    # Gemini CLI 有三种用途：Frontend (inbox/gemini/)、Researcher (inbox/research/)、Evaluator (inbox/evaluator/)
    # 任一 inbox 有 .md 文件即放行
    GEMINI_INBOX_COUNT=0
    for inbox_dir in ".selfmodel/inbox/gemini" ".selfmodel/inbox/research" ".selfmodel/inbox/evaluator"; do
        if [[ -d "${inbox_dir}" ]]; then
            while IFS= read -r -d '' _; do
                GEMINI_INBOX_COUNT=$((GEMINI_INBOX_COUNT + 1))
            done < <(find "${inbox_dir}" -maxdepth 1 -name "*.md" -print0 2>/dev/null)
        fi
    done

    if [[ "${GEMINI_INBOX_COUNT}" -eq 0 ]]; then
        PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] hook=enforce-agent-rules tool=gemini reason=no-gemini-inbox" \
          >> "${PROJECT_ROOT}/.selfmodel/state/hook-intercepts.log" 2>/dev/null || true

        {
            echo "🚨 [Hook 拦截] 违反「通信缓冲隔离」规则"
            echo ""
            echo "被拦截命令: ${COMMAND}"
            echo ""
            echo "调用 Gemini CLI 前必须将任务上下文写入 inbox 文件。"
            echo ""
            echo "正确做法:"
            echo "  Frontend 任务: 在 .selfmodel/inbox/gemini/ 下创建任务文件"
            echo "  Researcher 任务: 在 .selfmodel/inbox/research/ 下创建查询文件"
            echo ""
            echo "如需紧急绕过，使用: BYPASS_AGENT_RULES=1"
        } >&2
        exit 2
    fi
fi

if [[ "${HAS_CODEX}" == "true" ]]; then
    CODEX_INBOX_COUNT=0
    if [[ -d ".selfmodel/inbox/codex" ]]; then
        while IFS= read -r -d '' _; do
            CODEX_INBOX_COUNT=$((CODEX_INBOX_COUNT + 1))
        done < <(find .selfmodel/inbox/codex -maxdepth 1 -name "*.md" -print0 2>/dev/null)
    fi

    if [[ "${CODEX_INBOX_COUNT}" -eq 0 ]]; then
        PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] hook=enforce-agent-rules tool=codex reason=no-codex-inbox" \
          >> "${PROJECT_ROOT}/.selfmodel/state/hook-intercepts.log" 2>/dev/null || true

        {
            echo "🚨 [Hook 拦截] 违反「通信缓冲隔离」规则"
            echo ""
            echo "被拦截命令: ${COMMAND}"
            echo ""
            echo "调用 Codex Agent 前必须将任务上下文写入 inbox 文件。"
            echo ""
            echo "正确做法:"
            echo "  1. 在 .selfmodel/inbox/codex/ 下创建任务 Markdown 文件"
            echo "  2. 写入详细的任务描述、上下文、约束条件"
            echo "  3. CLI 命令中用 Read 指令引用文件"
            echo "  4. 示例: codex exec \"Read .selfmodel/inbox/codex/sprint-N.md and implement\" --full-auto"
            echo ""
            echo "如需紧急绕过，使用: BYPASS_AGENT_RULES=1"
        } >&2
        exit 2
    fi
fi

# 所有检查通过
exit 0
