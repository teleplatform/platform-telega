import { llmGenerateTagged } from "../llm/generateTagged.js";
import { ok, fail } from "../llm/contract.js";
import type { TeleMode } from "../llm/contract.js";
import { enforceBrands } from "../llm/enforceBrands.js";

type JsonMode = "strict" | "repair";

export async function llmGenerateStrictJSON(opts: {
  prompt: string;
  schemaHint?: string;
  mode: TeleMode;
  model?: string;
  jsonMode?: JsonMode;
  maxCharsPublic?: number;
}) {
  const model = opts.model ?? "deepseek-r1:1.5b";
  const jsonMode = opts.jsonMode ?? "strict";
  const maxCharsPublic = opts.maxCharsPublic ?? 6000;

  if (opts.mode === "public" && opts.prompt.length > maxCharsPublic) {
    return fail("limit", {
      message: "prompt too long",
      model,
      tagUsed: "json",
      mode: opts.mode,
    });
  }

  const systemRules = [
    `You output STRICT JSON only.`,
    `Return ONLY a single JSON value (object or array).`,
    `No markdown, no code fences, no comments, no trailing commas.`,
    `All keys MUST be double-quoted.`,
    `Strings MUST use double quotes.`,
    `If you cannot comply, return an empty JSON object: {}.`,
    `Keep these brand terms EXACTLY as-is if present: Tele•Ga, Tele•GPT, MarketBase, Services, Teleton.`,
  ].join("\n");

  const schemaHint = opts.schemaHint?.trim()
    ? `\n\nSCHEMA_HINT:\n${opts.schemaHint.trim()}\n`
    : "";

  const prompt = [
    systemRules,
    schemaHint,
    `TASK:`,
    opts.prompt.trim(),
    ``,
    `<json>`,
  ].join("\n");

  const gen = await llmGenerateTagged({
    model,
    tag: "json",
    prompt,
    mode: opts.mode,
  });

  const rawJson = gen.text?.trim() ?? "";
  const parsed = safeParseJson(rawJson);

  if (parsed.ok) {
    const addWarn = (d: typeof gen.debug, w: string) =>
      d ? { ...d, warnings: [...(d.warnings ?? []), w] } : d;

    let debug = gen.debug;

    if (opts.mode === "maker" && isEmptyObject(parsed.value)) {
      debug = addWarn(debug, "empty_object_returned");
    }

    return ok(
      { model, tagUsed: "json" },
      { value: enforceBrandsDeep(parsed.value) },
      opts.mode,
      debug
    );
  }

  if (jsonMode === "repair") {
    const repaired = tryRepairJson(rawJson);
    const parsed2 = safeParseJson(repaired);

    if (parsed2.ok) {
      // TeleDebug is present only in maker mode from llmGenerateTagged; guard before spreading.
      const addWarn = (d: any, w: string) =>
        d ? { ...d, warnings: [...(d.warnings ?? []), w] } : d;

      let debug = gen.debug;

      if (opts.mode === "maker") {
        debug = addWarn(debug, "json_repaired");
      }

      if (opts.mode === "maker" && isEmptyObject(parsed2.value)) {
        debug = addWarn(debug, "empty_object_returned");
      }

      return ok(
        { model, tagUsed: "json" },
        { value: enforceBrandsDeep(parsed2.value) },
        opts.mode,
        debug
      );
    }
  }

  return fail("invalid_json", {
    message: parsed.error,
    model,
    tagUsed: "json",
    mode: opts.mode,
    debug: gen.debug,
  });
}

function safeParseJson(s: string):
  | { ok: true; value: any }
  | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch {
    return { ok: false, error: "json_parse_failed" };
  }
}

function tryRepairJson(s: string) {
  let x = s.trim();
  x = x.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ""));
  x = x.replace(/```/g, "").trim();
  x = x.replace(/^\s*(here is|here's|json|output)\s*[:\-]\s*/i, "").trim();

  const firstObj = extractFirstJsonBlock(x);
  x = firstObj ?? x;
  x = x.replace(/,\s*([}\]])/g, "$1");
  return x;
}

function extractFirstJsonBlock(s: string): string | null {
  const i1 = s.search(/[\{\[]/);
  if (i1 < 0) return null;

  const open = s[i1];
  const close = open === "{" ? "}" : "]";

  let depth = 0;
  let inStr = false;
  let esc = false;

  for (let i = i1; i < s.length; i++) {
    const ch = s[i];

    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === "\"") inStr = false;
      continue;
    } else {
      if (ch === "\"") {
        inStr = true;
        continue;
      }
      if (ch === open) depth++;
      if (ch === close) depth--;
      if (depth === 0) {
        return s.slice(i1, i + 1).trim();
      }
    }
  }
  return null;
}

function enforceBrandsDeep(x: any): any {
  if (typeof x === "string") return enforceBrands(x);
  if (Array.isArray(x)) return x.map(enforceBrandsDeep);
  if (x && typeof x === "object") {
    const out: any = {};
    for (const k of Object.keys(x)) out[k] = enforceBrandsDeep(x[k]);
    return out;
  }
  return x;
}

function isEmptyObject(v: any) {
  return v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0;
}
