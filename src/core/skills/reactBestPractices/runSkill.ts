import { localChatCompletion } from "../../providers/localOpenAI.ts";

const SKILL_ID = "react-best-practices";
const VERSION = "1.0.0";

type Stage = "AutoReview" | "FixPlan" | "Patch";

function mustMaker(stage: Stage) {
  return stage === "Patch";
}

export async function runReactBestPracticesSkill(input: {
  stage: Stage;
  code: string;
  file_path?: string;
  maker_mode: boolean;
}) {
  if (mustMaker(input.stage) && !input.maker_mode) {
    return {
      ok: false,
      skill_id: SKILL_ID,
      version: VERSION,
      stage: input.stage,
      meta: { issues_count: 0, patch_bytes: 0, maker_mode: input.maker_mode, provider: "local" },
      error: "maker_required",
    };
  }

  const system =
    `You are a strict React/Next.js reviewer.\n` +
    `Return only the required output.\n` +
    `If stage=AutoReview: return JSON {"issues":[...]}.\n` +
    `If stage=FixPlan: return JSON {"steps":[...]}.\n` +
    `If stage=Patch: return only unified diff starting with ---/+++.\n`;

  const user =
    `stage=${input.stage}\n` +
    `file_path=${input.file_path || "unknown"}\n` +
    `CODE:\n${input.code}`;

  const res = await localChatCompletion({
    model: process.env.LOCAL_OPENAI_MODEL_DEFAULT || "qwen2.5:7b-instruct",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: input.stage === "Patch" ? 1200 : 700,
    temperature: 0.1,
  });

  if (input.stage === "Patch") {
    const diff = res.text.trim();
    const patch_bytes = Buffer.byteLength(diff, "utf8");
    return {
      ok: true,
      skill_id: SKILL_ID,
      version: VERSION,
      stage: input.stage,
      patch_diff: diff,
      meta: { issues_count: 0, patch_bytes, maker_mode: input.maker_mode, provider: "local" },
    };
  }

  let json: any = null;
  try {
    json = JSON.parse(res.text);
  } catch {
    json = null;
  }

  if (!json) {
    return {
      ok: false,
      skill_id: SKILL_ID,
      version: VERSION,
      stage: input.stage,
      meta: { issues_count: 0, patch_bytes: 0, maker_mode: input.maker_mode, provider: "local" },
      error: "invalid_json",
    };
  }

  if (input.stage === "AutoReview") {
    const issues = Array.isArray(json.issues) ? json.issues : [];
    return {
      ok: true,
      skill_id: SKILL_ID,
      version: VERSION,
      stage: input.stage,
      issues,
      meta: { issues_count: issues.length, patch_bytes: 0, maker_mode: input.maker_mode, provider: "local" },
    };
  }

  const steps = Array.isArray(json.steps) ? json.steps : [];
  return {
    ok: true,
    skill_id: SKILL_ID,
    version: VERSION,
    stage: input.stage,
    fix_plan: { steps },
    meta: { issues_count: 0, patch_bytes: 0, maker_mode: input.maker_mode, provider: "local" },
  };
}
