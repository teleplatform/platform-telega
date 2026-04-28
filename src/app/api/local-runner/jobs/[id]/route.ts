import { NextResponse } from "next/server";
import { getAuthContext } from "../../../_auth";
import { isMaker } from "../../../_guard";
import { CreatorWebStateStore } from "@/providers/creatorWebStateStore";
import { appendCreatorWebTrace } from "@/providers/creatorWebTraceWriter";
import { getCreatorWebProvider } from "@/providers/creatorWebRegistry";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const id = String(ctx?.params?.id || "");
  const base = process.env.TELEGPT_LOCAL_RUNNER_URL || "http://127.0.0.1:8787";
  const token = process.env.TELEGPT_LOCAL_RUNNER_TOKEN || "";

  try {
    const r = await fetch(`${base}/v1/jobs/${encodeURIComponent(id)}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j?.ok && j?.job) {
      const job = j.job;
      const provider_id = String(job.provider || job.provider_id || "");
      const status = String(job.status || "");
      const job_id = String(job.id || id || "");

      if (provider_id && (status === "done" || status === "failed")) {
        const store = new CreatorWebStateStore();
        await store.load();
        const snap = store.getSnapshot();
        const st = snap.providers?.[provider_id];
        const alreadyFinal =
          st?.last_runner_job_id === job_id &&
          (st?.last_runner_status === "done" || st?.last_runner_status === "failed");

        if (!alreadyFinal) {
          const reg = getCreatorWebProvider(provider_id);
          const trace_id = await appendCreatorWebTrace({
            provider_id,
            source_url: reg?.source_url || "(local-runner)",
            policy_id: reg?.policy_id || "human_interaction_policy_v1",
            action_type: st?.last_runner_action === "web:login" ? "login" : "health",
            delay_applied_ms: 0,
            policy_verdict: status === "done" ? "allowed" : "blocked",
            meta: {
              runner_job_id: job_id,
              lifecycle: "runner_job_finished",
              runner_status: status,
              exit_code: job.exit_code ?? null,
            },
          });

          store.setRunnerLink(provider_id, {
            job_id,
            trace_id: String(trace_id),
            action: st?.last_runner_action || "web:health",
            status: status as any,
          });
          await store.save();
        }
      }
    }
    return NextResponse.json(j, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: "unreachable",
      details: String(e?.message || e),
    });
  }
}
