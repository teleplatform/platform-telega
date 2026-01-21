import { ollamaGenerate } from "./ollama.ts";
import { extractTaggedText } from "./extract.ts";
import { enforceBrands } from "./enforceBrands.ts";
import type { TeleMode, TeleDebug } from "./contract.ts";

type GenerateTaggedArgs = {
  model: string;
  tag: string;
  prompt: string;
  temperature?: number;
  timeoutMs?: number;
  mode: TeleMode;
  provider?: "ollama";
};

export async function llmGenerateTagged(args: GenerateTaggedArgs): Promise<{
  text: string;
  raw: string;
  debug?: TeleDebug;
}> {
  const provider = args.provider ?? "ollama";
  const t0 = Date.now();

  const raw = await ollamaGenerate({
    model: args.model,
    prompt: args.prompt,
    temperature: args.temperature ?? 0,
    timeoutMs: args.timeoutMs ?? 60000,
    stream: false,
  });

  const latency_ms = Date.now() - t0;

  let text = extractTaggedText(raw, args.tag);
  text = enforceBrands(text);

  const warnings: string[] = [];
  if (!text.trim()) warnings.push("empty_output");
  if (!raw.includes(`<${args.tag}>`)) warnings.push("tag_not_found_in_raw");

  const debug: TeleDebug | undefined =
    args.mode === "maker"
      ? {
          provider,
          latency_ms,
          warnings,
          raw: raw?.slice(0, 5000),
        }
      : undefined;

  return { text, raw, debug };
}
