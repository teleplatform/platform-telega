import { NextResponse } from "next/server";
import { getAuthContext } from "../../../../_auth";
import { isMaker } from "../../../../_guard";
import { CreatorWebStateStore } from "@/providers/creatorWebStateStore";
import { appendCreatorWebTrace } from "@/providers/creatorWebTraceWriter";
import { getCreatorWebProvider } from "@/providers/creatorWebRegistry";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const provider_id = String(body?.provider_id || "").trim();
  const failed_session_id = String(body?.failed_session_id || "").trim();

  if (!provider_id || !failed_session_id) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }

  const base = process.env.TELEGPT_LOCAL_RUNNER_URL || "http://127.0.0.1:8787";
  const token = process.env.TELEGPT_LOCAL_RUNNER_TOKEN || "";

  const r = await fetch(`${base}/v1/jobs`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ action: "web:login", provider: provider_id }),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok || !j?.job_id) {
    return NextResponse.json(
      { ok: false, error: j?.error || "runnerd_job_create_failed", runnerd: j },
      { status: 500 }
    );
  }

  const job_id = String(j.job_id);
  const reg = getCreatorWebProvider(provider_id);

  const trace_id = await appendCreatorWebTrace({
    provider_id,
    source_url: reg?.source_url || "(local-runner)",
    policy_id: reg?.policy_id || "human_interaction_policy_v1",
    action_type: "login",
    delay_applied_ms: 0,
    policy_verdict: "allowed",
    meta: {
      runner_job_id: job_id,
      lifecycle: "runner_job_started",
      runner_action: "web:login",
      reason: "retry",
      failed_session_id,
    },
  });

  const store = new CreatorWebStateStore();
  await store.load();
  store.setRunnerLink(provider_id, {
    job_id,
    trace_id: String(trace_id),
    action: "web:login",
    status: "running",
  });
  await store.save();

  return NextResponse.json({
    ok: true,
    provider_id,
    failed_session_id,
    runner_job_id: job_id,
  });
}
