import { NextResponse } from "next/server";
import { runReactBestPracticesSkill } from "@/core/skills/reactBestPractices/runSkill";
import { writeTrace } from "@/core/traces/writeTrace";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const stage = body?.stage as "AutoReview" | "FixPlan" | "Patch" | undefined;
  const code = typeof body?.code === "string" ? body.code : "";
  const file_path = typeof body?.file_path === "string" ? body.file_path : undefined;
  const maker_mode = Boolean(body?.maker_mode);

  if (!stage || !code) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const result = await runReactBestPracticesSkill({
    stage,
    code,
    file_path,
    maker_mode,
  });

  const issues_count = Array.isArray(result.issues) ? result.issues.length : 0;
  const patch_bytes = typeof result.patch_diff === "string" ? Buffer.byteLength(result.patch_diff, "utf8") : 0;

  const trace_id = await writeTrace({
    ok: result.ok,
    route: "/v1/skills/react-best-practices/run",
    provider: "local",
    lane: "skill",
    intent: "skill_run",
    intent_source: "skill",
    intent_reason: result.stage,
    fallback_used: false,
    failures_count: result.ok ? 0 : 1,
    timeouts: 0,
    max_tokens: stage === "Patch" ? 1200 : 700,
    skill_id: "react-best-practices",
    skill_stage: result.stage,
    issues_count,
    patch_bytes,
    maker_mode,
    meta: {
      input: code.slice(0, 5000),
      file_path,
      stage,
      output: result.patch_diff ?? JSON.stringify(result.issues ?? result.fix_plan ?? {}),
    },
  });

  return NextResponse.json({ ...result, trace_id });
}
