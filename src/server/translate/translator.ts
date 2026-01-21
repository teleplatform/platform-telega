import type { TranslateRequest, TranslateResponse } from "@/features/translate/types";
import { protectTokens, restoreTokens } from "./memory";

function styleHint(styleId: string) {
  switch (styleId) {
    case "formal": return "Formal, business-appropriate tone.";
    case "simple": return "Simple, clear, easy-to-understand.";
    case "academic": return "Academic tone, precise terminology.";
    case "marketing": return "Marketing tone, persuasive but natural.";
    case "short": return "Keep it short.";
    case "telegram": return "Telegram-style: concise, friendly.";
    case "tele_ga_voice": return "Tele•Ga brand voice: confident, warm, modern.";
    default: return "Natural, faithful translation.";
  }
}

/**
 * Super-stable baseline:
 * - Translation Memory protect/restore
 * - If Ollama available: use it
 * - Else: stub so UI работает сразу
 */
export async function translate(req: TranslateRequest): Promise<TranslateResponse> {
  const { protectedText, restoreMap } = protectTokens(req.sourceText);

  const prompt = [
    `You are a professional translator.`,
    `Return ONLY the translation in ${req.targetLang.toUpperCase()}.`,
    `No explanations. No lists. No variants. No quotes. No markdown.`,
    `Never repeat the source text.`,
    `Keep any code/commands/paths/JSON unchanged.`,
    `Style: ${styleHint(req.styleId)}`,
    ``,
    `TEXT:`,
    protectedText,
    ``,
    `TRANSLATION:`,
  ].join("\n");

  // 1) Try Ollama (локально у тебя это есть)
  const base = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "translategemma:en";

  try {
    const r = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0, num_predict: 128 },
      }),
    });

    if (r.ok) {
      const j = (await r.json()) as any;
      const raw = String(j?.response ?? "").trim();
      const restored = restoreTokens(raw, restoreMap);
      return {
        translatedText: restored,
        detectedLang: req.sourceLang === "auto" ? "ru" : undefined,
        styleApplied: req.styleId,
        format: req.format,
      };
    }
  } catch {
    // ignore -> fallback
  }

  // 2) Fallback: чтобы UI жил даже без провайдера
  const fallback = `[Provider offline] ${req.targetLang.toUpperCase()} translation will appear here.`;
  return {
    translatedText: restoreTokens(fallback, restoreMap),
    detectedLang: req.sourceLang === "auto" ? "ru" : undefined,
    styleApplied: req.styleId,
    format: req.format,
    warnings: ["provider_offline"],
  };
}
