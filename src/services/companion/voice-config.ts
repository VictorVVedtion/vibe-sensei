/**
 * Voice Configuration — maps each archetype to a unique Gemini TTS voice profile.
 *
 * 9 archetypes × 1 voice each. Each profile defines the Gemini prebuilt voice name,
 * a natural-language style instruction prepended to the text, a speaking rate, and
 * a language code.
 *
 * Voice names come from the Gemini 2.5 Flash Preview TTS prebuilt set:
 *   Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Zephyr, Sulafat, Enceladus, Orbit
 *
 * If a voice name is unavailable at runtime, the TTS service will fall back to 'Kore'.
 */

import type { Archetype } from '../../buddy/persona.js'

// ── Types ────────────────────────────────────────────────────────────────

export interface VoiceProfile {
  /** Gemini prebuilt voice name. */
  voiceName: string
  /** Natural-language speaking style instruction prepended to the text. */
  stylePrompt: string
  /** Speaking rate multiplier, 0.5–2.0. Default: 1.0. */
  speakingRate: number
  /** BCP-47 language code. */
  language: string
}

// ── Fallback ─────────────────────────────────────────────────────────────

/** Safe default when a voice name is not available on the server. */
export const FALLBACK_VOICE_NAME = 'Kore'

// ── Voice Map ────────────────────────────────────────────────────────────

export const ARCHETYPE_VOICES: Record<Archetype, VoiceProfile> = {
  value_investor: {
    voiceName: 'Sulafat',
    stylePrompt:
      'Speak warmly like a wise grandfather sharing life lessons. Slow, measured pace.',
    speakingRate: 0.9,
    language: 'zh-CN',
  },

  trend_follower: {
    voiceName: 'Kore',
    stylePrompt:
      'Speak firmly and decisively, like a trader calling out positions on the floor.',
    speakingRate: 1.1,
    language: 'zh-CN',
  },

  macro_trader: {
    voiceName: 'Charon',
    stylePrompt:
      'Speak with gravitas, like a central banker delivering a policy statement.',
    speakingRate: 0.95,
    language: 'zh-CN',
  },

  quant: {
    voiceName: 'Enceladus',
    stylePrompt:
      'Speak precisely and calmly, like a mathematician presenting a proof.',
    speakingRate: 1.0,
    language: 'zh-CN',
  },

  strategist: {
    voiceName: 'Fenrir',
    stylePrompt:
      'Speak with commanding authority, like a general briefing before battle.',
    speakingRate: 0.9,
    language: 'zh-CN',
  },

  philosopher: {
    voiceName: 'Aoede',
    stylePrompt:
      'Speak contemplatively, with pauses for reflection, like a philosopher in dialogue.',
    speakingRate: 0.85,
    language: 'zh-CN',
  },

  first_principles: {
    voiceName: 'Puck',
    stylePrompt:
      'Speak with energetic clarity, like a tech founder pitching the future.',
    speakingRate: 1.15,
    language: 'zh-CN',
  },

  crypto_native: {
    voiceName: 'Leda',
    stylePrompt:
      'Speak with mysterious undertones, like someone who knows secrets about the future of money.',
    speakingRate: 1.0,
    language: 'zh-CN',
  },

  scientist: {
    voiceName: 'Orbit',
    stylePrompt:
      'Speak with precise curiosity, like a scientist explaining a discovery.',
    speakingRate: 1.0,
    language: 'zh-CN',
  },
}
