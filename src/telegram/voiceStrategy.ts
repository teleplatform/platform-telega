/**
 * Voice Strategy Layer v1.0
 *
 * Bounded decision layer: decides WHEN to use voice vs text.
 * Does NOT synthesize. Does NOT deliver. Only decides.
 *
 * Modes:
 *   voice_quality  → use Kozy (live, high-quality, slow ~30s)
 *   text_only      → intentional text (no voice worth generating)
 *
 * Future slot:
 *   voice_fast     → PREPARED only (no real fast provider live yet)
 */

export type VoiceStrategyMode = "voice_quality" | "voice_fast" | "text_only";

export interface VoiceStrategyResult {
  mode: VoiceStrategyMode;
  reason: string;
  voice_allowed: boolean;
  preferred_provider: "kozy" | null;
}

// Ultra-short tokens that don't benefit from voice
const ULTRA_SHORT_TOKENS = new Set([
  "ok", "ок", "да", "нет", "ага", "угу", "ну", "ладно", "ясно",
  "понял", "понятно", "хорошо", "спс", "спасибо", "thanks",
  "bye", "пока", "привет", "здравствуй", "hi", "hello", "hey",
]);

// Greeting/acknowledgement patterns
const GREETING_RE = /^(привет|здравствуй|добрый|хай|хей|hi|hello|hey|ok|ок|да|нет|ага|угу|ладно|ясно|понял|понятно|хорошо|спс|спасибо|thanks|bye|пока)[\s.!?…]*$/iu;

export interface VoiceStrategyConfig {
  /** Max chars for voice_quality (default 200) */
  maxVoiceChars: number;
  /** Chars above which we force text_only (default 500) */
  hardTextLimit: number;
  /** Whether Kozy provider is considered live */
  kozyLive: boolean;
  /** Whether a fast provider exists (default: true if say command available) */
  fastProviderLive: boolean;
  /** Max chars for fast provider (default 300) */
  fastProviderMaxChars: number;
}

function defaultConfig(): VoiceStrategyConfig {
  // Check if macOS say/afconvert available for fast provider
  let fastLive = false;
  try {
    const fs = require("fs");
    fastLive = fs.existsSync("/usr/bin/say") && fs.existsSync("/usr/bin/afconvert");
  } catch { /* ignore */ }

  return {
    maxVoiceChars: Number(process.env.ARISHA_VOICE_MAX_CHARS || "200"),
    hardTextLimit: Number(process.env.ARISHA_VOICE_HARD_TEXT_LIMIT || "500"),
    kozyLive: process.env.KOZY_ENABLED !== "false",
    fastProviderLive: process.env.VOICE_FAST_PROVIDER_ENABLED !== "false" && fastLive,
    fastProviderMaxChars: Number(process.env.VOICE_FAST_MAX_CHARS || "300"),
  };
}

/**
 * Decide voice strategy for the given input text.
 * Pure function — no side effects, no I/O.
 */
export function decideVoiceStrategy(
  text: string,
  cfg?: Partial<VoiceStrategyConfig>,
): VoiceStrategyResult {
  const c = { ...defaultConfig(), ...cfg };
  const trimmed = text.trim();
  const len = trimmed.length;
  const lower = trimmed.toLowerCase();

  // Empty / whitespace → text_only
  if (!trimmed) {
    return { mode: "text_only", reason: "empty_input", voice_allowed: false, preferred_provider: null };
  }

  // Commands → text_only
  if (trimmed.startsWith("/")) {
    return { mode: "text_only", reason: "command_input", voice_allowed: false, preferred_provider: null };
  }

  // Ultra-short single tokens → text_only (no voice value)
  if (ULTRA_SHORT_TOKENS.has(lower)) {
    return { mode: "text_only", reason: "ultra_short_ack", voice_allowed: false, preferred_provider: null };
  }

  // Greeting/acknowledgement one-liners → text_only
  if (GREETING_RE.test(trimmed) && len < 40) {
    return { mode: "text_only", reason: "greeting_or_ack", voice_allowed: false, preferred_provider: null };
  }

  // Hard limit → text_only
  if (len > c.hardTextLimit) {
    return { mode: "text_only", reason: `too_long_for_voice_${len}_>${c.hardTextLimit}`, voice_allowed: false, preferred_provider: null };
  }

  // Short-medium reply: fast provider slot (≤ fastProviderMaxChars, fast TTS)
  if (len <= c.fastProviderMaxChars && c.fastProviderLive) {
    return { mode: "voice_fast", reason: `short_reply_${len}chars_fast`, voice_allowed: true, preferred_provider: null };
  }

  // Short reply under maxVoiceChars but fast not available → voice_quality if Kozy live
  if (len <= c.maxVoiceChars) {
    if (c.kozyLive) {
      return { mode: "voice_quality", reason: `short_friendly_${len}chars`, voice_allowed: true, preferred_provider: "kozy" };
    }
    return { mode: "text_only", reason: "kozy_unavailable", voice_allowed: false, preferred_provider: null };
  }

  // Medium reply (between maxVoiceChars and hardTextLimit) → text_only intentionally
  // These are useful to read but too long for comfortable voice wait
  return { mode: "text_only", reason: `medium_length_${len}chars_text_preferred`, voice_allowed: false, preferred_provider: null };
}
