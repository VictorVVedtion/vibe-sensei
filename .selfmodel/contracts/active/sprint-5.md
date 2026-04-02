# Sprint 5: Guardian Persona Prompt System

## Task Preamble
你是 selfmodel 团队的 backend engineer (Codex)。铁律: Never Fallback, Never Mock, Never Lazy。原子提交 `sprint-5: <what>`。

## Objective
将守护者大师人格注入 AI 查询循环

## Assigned To
codex

## Deliverables
- [ ] src/buddy/persona.ts — 守护者人格提示词系统

## Acceptance Criteria
1. 导出 `buildGuardianSystemPrompt(master: Master): string` 生成完整的守护者人格指令
2. 提示词包含: 大师身份、交易哲学、风控风格、语气指导
3. 根据大师的 stats (PRECISION/PATIENCE/AGGRESSION/WISDOM/SASS) 调整语气描述
4. 高 SASS 大师: 尖锐直接; 高 WISDOM: 冷静分析; 高 AGGRESSION: 大胆激进
5. 提示词 ≤300 tokens (LLM 预训练已知人物, 不需要大量描述)
6. 导出 `getPersonalizedAlert(master: Master, alert: RiskAlert): string` 用大师风格包装风控告警
7. bun run build 编译通过

## Context Files
- src/buddy/types.ts (Master, MASTER_NAMES, MASTER_QUOTES, STAT_NAMES, CompanionBones)
- src/buddy/companion.ts (getCompanion, getGuardianPrompt, getMasterName)
- src/buddy/guardian.ts (RiskAlert, Severity)

## Constraints
- Max execution time: 120s
- 不修改已有文件, 只创建 persona.ts
- 利用 LLM 预训练知识, 提示词要简洁 ("You are Warren Buffett" 比 500 字传记有效)

当前状态: **ACTIVE**
