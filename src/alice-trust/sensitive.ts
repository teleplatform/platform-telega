// ─────────────────────────────────────────────────────────────
// ALICE TRUST / SAFETY CONVERSATION GUARDRAILS PACK v1.0 — Sensitive Intent Detection
//
// Bounded sensitive intent detection.
// Categories: self_harm, violence, illegal, privacy, medical, sexual, manipulation, unknown, none
// ─────────────────────────────────────────────────────────────

import type { AliceSensitiveIntentDecision } from "./types.js";

// Bounded v1 pattern matching for sensitive intent categories
const SENSITIVE_PATTERNS: Record<AliceSensitiveIntentDecision["category"], RegExp[]> = {
  self_harm: [
    /как (убить себя|покончить с собой|нанести себе вред)/i,
    /(мне (хуже некуда|не хочу жить|больше не могу))/i,
  ],
  violence: [
    /как (убить|ранить|избить|навредить)/i,
    /(хочу (отомстить|напасть|сломать))/i,
  ],
  illegal: [
    /как (украсть|взломать|обмануть|подделать)/i,
    /где (купить (запрещен|нелегаль))/i,
  ],
  privacy: [
    /как (узнать (личные|приватные) данные)/i,
    /(расскажи про (чужие|личные) секреты)/i,
  ],
  medical: [
    /как (лечить|диагностировать|принимать (лекарств|препарат))/i,
    /(мне (плохо|больно|нужен врач))/i,
  ],
  sexual: [
    /как (соблазнить|заставить|принудить к сексу)/i,
  ],
  manipulation: [
    /как (манипулировать|контролировать|давить на)/i,
    /как (заставить|убедить обманом)/i,
  ],
  unknown: [],
  none: [],
};

export function detectAliceSensitiveIntent(input: {
  utterance: string;
  contextHints?: string[];
}): AliceSensitiveIntentDecision {
  const utterance = input.utterance.toLowerCase();
  const contextHints = input.contextHints ?? [];
  const fullContext = [utterance, ...contextHints].join(" ").toLowerCase();

  for (const [category, patterns] of Object.entries(SENSITIVE_PATTERNS)) {
    if (category === "unknown" || category === "none") continue;

    for (const pattern of patterns) {
      if (pattern.test(fullContext)) {
        return {
          detected: true,
          category: category as AliceSensitiveIntentDecision["category"],
          requiresBoundary: true,
          notes: [`Sensitive intent detected: ${category}`],
        };
      }
    }
  }

  return {
    detected: false,
    category: "none",
    requiresBoundary: false,
  };
}

export function getSensitiveCategoryDescription(category: AliceSensitiveIntentDecision["category"]): string {
  switch (category) {
    case "self_harm":
      return "Self-harm intent — user may be expressing distress about self-harm";
    case "violence":
      return "Violence intent — user may be seeking to cause harm to others";
    case "illegal":
      return "Illegal intent — user may be seeking to engage in illegal activity";
    case "privacy":
      return "Privacy concern — user may be requesting private/personal information";
    case "medical":
      return "Medical concern — user may be seeking medical advice or expressing health distress";
    case "sexual":
      return "Sexual intent — user may be seeking inappropriate sexual content or behavior";
    case "manipulation":
      return "Manipulation intent — user may be seeking to manipulate or deceive others";
    case "unknown":
      return "Unknown intent — risk indeterminate";
    case "none":
      return "No sensitive intent detected";
    default:
      return `Unknown category: ${category}`;
  }
}
