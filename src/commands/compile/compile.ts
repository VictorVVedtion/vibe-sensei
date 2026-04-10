/**
 * /compile slash command — compiles JSONL trading events into a wiki.
 *
 * Usage:
 *   /compile        — incremental compilation (new events only)
 *   /compile --full — full recompile from scratch
 *
 * Supports both LLM-powered and template-based compilation.
 * Template mode works without any API key.
 */

import type { LocalCommandCall, LocalCommandResult } from '../../types/command.js'

/** Entry point for the /compile command. */
export const call: LocalCommandCall = async (
  args: string,
): Promise<LocalCommandResult> => {
  const isFull = args.trim() === '--full'

  try {
    const { compile, requestLLMConsent } = await import(
      '../../services/knowledge/compiler.js'
    )

    // Check if consent is needed for LLM mode
    const apiKey = process.env.GEMINI_API_KEY ?? ''
    if (apiKey.length > 0) {
      await requestLLMConsent()
    }

    const label = isFull ? 'Full recompile' : 'Incremental compile'
    console.log(`Compiling knowledge base... (${label})`)

    const result = await compile({ full: isFull })

    const lines: string[] = []
    lines.push(`Knowledge base compiled: ${result.eventsProcessed} events processed`)
    lines.push(`Articles updated: ${result.articlesUpdated}`)
    lines.push(`Mode: ${result.mode}`)

    if (result.warnings.length > 0) {
      lines.push('')
      for (const w of result.warnings) {
        lines.push(`  ${w}`)
      }
    }

    if (result.articlesUpdated > 0) {
      lines.push('')
      lines.push('Wiki location: ~/.vibe-sensei/wiki/')
    }

    return { type: 'text', value: lines.join('\n') }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      type: 'text',
      value: `Knowledge base compilation failed: ${message}`,
    }
  }
}
