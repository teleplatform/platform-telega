import { llmGenerateTagged } from "../llm/generateTagged.js";

export async function llmTranslateToEN(opts: {
  sourceText: string;
  mode: "public" | "maker";
}) {
  const prompt = [
    `You are a professional translator.`,
    `Return ONLY the English translation.`,
    `No explanations, no lists, no variants.`,
    `Never repeat the source text.`,
    `Keep code/commands/paths/JSON unchanged.`,
    `Keep these brand terms EXACTLY as-is: Tele•Ga, Tele•GPT, MarketBase, Services, Teleton.`,
    ``,
    `TEXT:`,
    opts.sourceText,
    ``,
    `<t>`,
  ].join("\n");

  return llmGenerateTagged({
    model: "translategemma:en",
    tag: "t",
    prompt,
    temperature: 0,
    timeoutMs: 60000,
    mode: opts.mode,
  });
}
