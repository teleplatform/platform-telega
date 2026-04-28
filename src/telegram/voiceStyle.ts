/**
 * Voice Personality / Style Layer v1.0
 *
 * Bounded speaking-style decisions — NOT a persona engine.
 * Chooses HOW to sound based on explicit text patterns.
 *
 * Style modes:
 *   neutral     — default, factual, balanced
 *   warm        — friendly, approachable, slightly softer
 *   supportive  — calm, reassuring, gentle pacing
 *   concise     — brief, direct, minimal
 *
 * Provider adaptation:
 *   say_macos (voice_fast): adjusts speech rate via -r parameter
 *   Kozy (voice_quality): text shaping only (provider doesn't support style params)
 *
 * This layer does NOT:
 *   - Rewrite meaning
 *   - Add emotional content not present in original
 *   - Claim provider can do more than it actually can
 */

export type VoiceStyleMode = "neutral" | "warm" | "supportive" | "concise";

export interface VoiceStyleResult {
  mode: VoiceStyleMode;
  reason: string;
  /** Shaped text for provider (may equal original text if no shaping needed) */
  shapedText: string;
  /** Provider-specific hint (speech rate, voice choice, etc.) */
  providerHint: Record<string, unknown>;
}

// Pattern-based style rules — explicit, no ML
const SUPPORT_PATTERNS = [
  /поддержк|тяжело|страшно|грустно|плохо|устал|помоги|помогите/iu,
  /нужна поддержка|нужен совет|что делать|не знаю/iu,
];

const WARM_PATTERNS = [
  /^(привет|здравствуй|добрый\s+(день|утро|вечер)|хай|хей|hello|hi|hey)/iu,
  /^(как (дела|ты|поживаешь|настроение)|что нового)/iu,
];

const CONCISE_PATTERNS = [
  /^(ok|ок|да$|нет$|ага|угу|ладно|ясно|понял|понятно|хорошо|спс|спасибо)/iu,
  /^(подтверждаю|согласен|сделано|готово|принято)/iu,
];

/**
 * Decide voice style for the given input text.
 * Pure function — no side effects.
 */
export function decideVoiceStyle(
  text: string,
  _provider?: "kozy" | "say_macos",
): VoiceStyleResult {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Support patterns → supportive style
  for (const pattern of SUPPORT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        mode: "supportive",
        reason: "support_detected",
        shapedText: trimmed,
        providerHint: { speechRate: 0.85 }, // slightly slower, calming
      };
    }
  }

  // Concise patterns → concise style
  for (const pattern of CONCISE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        mode: "concise",
        reason: "concise_ack",
        shapedText: trimmed,
        providerHint: { speechRate: 1.1 }, // slightly faster for brief replies
      };
    }
  }

  // Warm patterns → warm style
  for (const pattern of WARM_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        mode: "warm",
        reason: "warm_greeting",
        shapedText: trimmed,
        providerHint: { speechRate: 0.95 }, // slightly softer
      };
    }
  }

  // Short functional replies (non-empty) → concise
  if (trimmed.length > 0 && trimmed.length < 30 && !/\s{3,}/.test(trimmed)) {
    return {
      mode: "concise",
      reason: "short_reply",
      shapedText: trimmed,
      providerHint: { speechRate: 1.05 },
    };
  }

  // Default → neutral
  return {
    mode: "neutral",
    reason: "default_neutral",
    shapedText: trimmed,
    providerHint: { speechRate: 1.0 },
  };
}

/**
 * Adapt speech rate for macOS say command based on style.
 * Returns the -r argument value (rate in words per minute, ~100-300 range).
 * Default say rate is ~200 wpm.
 */
export function adaptSpeechRateForSay(style: VoiceStyleMode): number {
  switch (style) {
    case "supportive": return 160; // slower, calming
    case "warm": return 180; // slightly softer
    case "concise": return 220; // slightly faster
    case "neutral": default: return 200; // default
  }
}
