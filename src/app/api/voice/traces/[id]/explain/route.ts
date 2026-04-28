import { getVoiceTrace } from "@/server/voice/traceReader";

export const runtime = "nodejs";

function deriveWhy(t: any) {
  if (t?.failover_used) return t?.meta?.failover_reason || "unknown";
  if (t?.route === "say") return "ok";
  if (t?.route === "speak") return "default_or_binding";
  return "unknown";
}

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const id = String(ctx.params.id || "").trim();
  if (!id) return Response.json({ ok: false, error: "missing_id" }, { status: 400 });

  const t = await getVoiceTrace(id);
  if (!t) return Response.json({ ok: false, error: "not_found" }, { status: 404 });

  const why = deriveWhy(t);

  const explain = {
    id: t.id,
    created_at: t.created_at,
    summary: {
      route: t.route,
      preset: t.preset,
      speaker: t.speaker,
      failover_used: t.failover_used,
      why,
    },
    metrics: {
      tts_ms: t.tts_ms,
      dsp_ms: t.dsp_ms,
      rtf: t.rtf,
      chunks: t.chunks,
    },
    env: t.meta && (t.meta as any).env ? (t.meta as any).env : null,
    meta: t.meta ?? {},
  };

  return Response.json({ ok: true, explain }, { headers: { "cache-control": "no-store" } });
}
