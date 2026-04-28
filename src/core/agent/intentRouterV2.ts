import { classifyIntentV1, type IntentResult } from "./intentRouterV1.ts";
import { llmGenerateTagged } from "../../server/llm/generateTagged.ts";

export type Intent = IntentResult["intent"];

const INTENT2_THRESHOLD = Number(process.env.INTENT2_THRESHOLD || "0.65");

export async function classifyIntentV2(inputRaw: string): Promise<IntentResult> {
  const base = classifyIntentV1(inputRaw);
  if (base.confidence >= INTENT2_THRESHOLD) return base;

  const model =
    process.env.INTENT2_MODEL ||
    process.env.LOCAL_OPENAI_MODEL_DEFAULT ||
    "qwen2.5:7b-instruct";

  const prompt = [
    `Return ONLY JSON in <json>...</json> tag.`,
    `No markdown, no explanations.`,
    `Schema: {"intent":"buy|inquiry|booking|delivery|warranty|unknown","confidence":0.0,"reason":"..."}`,
    `If unsure, return intent=unknown.`,
    ``,
    `TEXT:`,
    inputRaw,
    ``,
    `<json>`,
  ].join("\n");

  try {
    const res = await llmGenerateTagged({
      model,
      tag: "json",
      prompt,
      mode: "public",
      temperature: 0,
      timeoutMs: 20000,
    });

    const parsed = safeParseJson(res.text);
    if (!parsed) {
      return { intent: "unknown", confidence: 0, reason: "llm_invalid_json", source: "llm" };
    }

    const intent = normalizeIntent(parsed.intent);
    const confidence = clampNumber(parsed.confidence);
    const reason = typeof parsed.reason === "string" && parsed.reason.trim() ? parsed.reason : "llm";

    return { intent, confidence, reason, source: "llm" };
  } catch {
    return { intent: "unknown", confidence: 0, reason: "llm_error", source: "llm" };
  }
}

function safeParseJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeIntent(v: unknown): Intent {
  switch (String(v)) {
    case "buy":
    case "inquiry":
    case "booking":
    case "delivery":
    case "warranty":
    case "unknown":
      return v as Intent;
    default:
      return "unknown";
  }
}

function clampNumber(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
