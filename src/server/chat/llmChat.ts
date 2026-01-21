import { llmGenerateTagged } from "../llm/generateTagged.js";
import { BRAND } from "../llm/enforceBrands.js";
import { ok, fail } from "../llm/contract.js";

export type LlmChatAnswerInput = {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model?: string;
  mode?: "public" | "maker";
};

export async function llmChatAnswer(input: LlmChatAnswerInput) {
  const model = input.model ?? "deepseek-r1:1.5b";
  const mode = input.mode ?? "public";

  // Превращаем messages в простой текст
  const transcript = input.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const prompt = `
You are Tele•GPT.
Follow the rules strictly:
- Output ONLY <answer>...</answer>
- No markdown, no code fences, no lists unless user explicitly asked for a list.
- Keep these brand terms EXACTLY as-is: ${BRAND.join(", ")}.

${transcript}

<answer>`.trim();

  try {
    const out = await llmGenerateTagged({
      model,
      tag: "answer",
      prompt,
      mode,
    });

    const answer = out.text.trim();
    if (!answer) {
      return fail("empty_answer", { model, tagUsed: "answer", mode, debug: out.debug });
    }

    return ok(
      { model, tagUsed: "answer" },
      { answer },
      mode,
      out.debug
    );
  } catch (e: any) {
    return fail("llm_failed", {
      message: e?.message ?? "unknown",
      model,
      tagUsed: "answer",
      mode,
    });
  }
}
