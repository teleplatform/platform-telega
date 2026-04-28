import { llmGenerateTagged } from "../llm/generateTagged.js";
import { BRAND } from "../llm/enforceBrands.js";
import { ok, fail } from "../llm/contract.js";

export type LlmChatAnswerInput = {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model?: string;
  mode?: "public" | "maker";
};

const TELEGPT_ANSWER = "Tele•GPT — это инструмент для общения и помощи, созданный на основе современных AI-технологий. Продукт платформы Tele•Ga. Помогает решать задачи, отвечать на вопросы и сопровождать пользователя в работе и жизни.";

const MOSCOW_412_ANSWER = "Москвич 412. Надёжно, просто и едет.";

function cleanOutput(text: string): string {
  text = text.replace(/(st){3,}/gi, "");
  text = text.replace(/[\u4e00-\u9fff]+/g, "");
  text = text.replace(/[。、！？]/g, "");
  const count = (text.match(/Москвич 412/g) || []).length;
  if (count > 1) {
    text = MOSCOW_412_ANSWER;
  }
  return text.trim();
}

function protectBrand(text: string): string {
  const banned = ["alibaba", "qwen", "openai", "gpt-", "ollama", "llm", "cloud", "model"];
  const lower = text.toLowerCase();
  for (const word of banned) {
    if (lower.includes(word)) {
      return TELEGPT_ANSWER;
    }
  }
  return text;
}

export async function llmChatAnswer(input: LlmChatAnswerInput) {
  const model = input.model ?? "qwen2.5:7b-instruct";
  const mode = input.mode ?? "public";

  const transcript = input.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const userText = input.messages.at(-1)?.content ?? "";
  const isModelQuestion = /модел|под капотом|на чём ты|what model|underlying/i.test(userText);
  const isTelegptQuestion = /что.*telegpt|расскажи.*telegpt|про.*telegpt/i.test(userText);

  const prompt = `
Ты — ассистент Tele•GPT.

О продукте Tele•GPT:
${TELEGPT_ANSWER}

Правила:

1. ЗАПРЕЩЕНО:
- Упоминать любые компании, модели или провайдеров (Alibaba, OpenAI, Qwen и т.д.)
- Рассказывать о технической реализации
- Говорить, "на чём ты работаешь"

2. Если спрашивают "какая модель", "что под капотом", "на чём работаешь":
→ ${MOSCOW_412_ANSWER}

3. Если спрашивают про Tele•GPT:
→ ${TELEGPT_ANSWER}

4. Стиль: только русский, коротко, чётко, без воды

5. Если не уверен — скажи прямо

Output ONLY <answer>...</answer>

${transcript}

<answer>`.trim();

  try {
    const out = await llmGenerateTagged({
      model,
      tag: "answer",
      prompt,
      mode,
    });

    const rawAnswer = out.text.trim();
    const cleaned = cleanOutput(rawAnswer);
    const answer = protectBrand(cleaned);
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
