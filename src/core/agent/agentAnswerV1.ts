import { loadKnowledgePackV2 } from "../knowledge/loadKnowledgePack.ts";
import { classifyIntentV2 } from "./intentRouterV2.ts";
import { policyForIntentV1 } from "./policyRouterV1.ts";
import { localChatCompletion } from "../providers/localOpenAI.ts";
import { qwenChat } from "../providers/qwenRouter.ts";

export async function agentAnswerV1(args: { input: string; knowledge_pack_id: string }) {
  const { pack, source, version, etag } = await loadKnowledgePackV2(args.knowledge_pack_id);

  const intentRes = await classifyIntentV2(args.input);
  const policy = policyForIntentV1(intentRes.intent);

  let failures_count = 0;
  let timeouts = 0;
  let fallback_used = false;

  const started = Date.now();
  const provider = (process.env.TELEGPT_PROVIDER_DEFAULT || "local").toLowerCase();
  const messages = [
    {
      role: "system",
      content:
        `Ты — агент продаж/поддержки.\n` +
        `Правила:\n` +
        `- Используй только факты из knowledge.\n` +
        `- Не выдумывай цены/условия.\n` +
        `- Сохраняй бренд-термины без изменений: ${(pack.brand_terms || []).join(", ")}.\n` +
        `Knowledge JSON: ${JSON.stringify(pack)}`,
    },
    { role: "user", content: args.input },
  ] as const;

  try {
    let output = "";
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;

    if (provider === "qwen") {
      const r = await qwenChat({
        messages: [...messages],
        temperature: 0.2,
        max_tokens: policy.max_tokens,
      });
      output = r.output;
      usage = r.usage;
      fallback_used = r.fallback_used;
      failures_count = r.fallback_used ? 1 : 0;
    } else {
      const res = await localChatCompletion({
        model: process.env.LOCAL_OPENAI_MODEL_DEFAULT || "qwen2.5:7b-instruct",
        messages: [...messages],
        max_tokens: policy.max_tokens,
        temperature: 0.2,
      });
      output = res.text;
      usage = res.usage;
      failures_count = 0;
    }

    const latency_ms = Date.now() - started;

    return {
      ok: true,
      output,
      intent: intentRes.intent,
      intent_source: intentRes.source,
      intent_reason: intentRes.reason,
      lane: policy.lane,
      max_tokens: policy.max_tokens,
      timeout_ms: policy.timeout_ms,
      fallback_used,
      failures_count,
      timeouts,
      knowledge_source: source,
      knowledge_version: version,
      knowledge_etag: etag,
      latency_ms,
      usage: usage ?? null,
      intent_confidence: intentRes.confidence,
    };
  } catch (e) {
    failures_count++;
    throw e;
  }
}
