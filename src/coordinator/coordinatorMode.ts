/**
 * Coordinator mode stub — feature permanently disabled in Vibe Sensei.
 * Kept as a minimal stub because isCoordinatorMode() is statically imported
 * by AgentTool, forkSubagent, resumeAgent, BackgroundTasksDialog.
 */

export function isCoordinatorMode(): boolean {
  return false
}

export function matchSessionMode(
  _sessionMode: string | undefined,
): string | undefined {
  return undefined
}

export function getCoordinatorUserContext(): Record<string, unknown> {
  return {}
}

export function getCoordinatorSystemPrompt(): string {
  return ''
}
