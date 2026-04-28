import { getVoiceTrace } from "@/server/voice/traceReader";

export const runtime = "nodejs";

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const id = String(ctx.params.id || "").trim();
  if (!id) return Response.json({ ok: false, error: "missing_id" }, { status: 400 });

  const row = await getVoiceTrace(id);
  if (!row) return Response.json({ ok: false, error: "not_found" }, { status: 404 });

  return Response.json(
    { ok: true, trace: row },
    { headers: { "cache-control": "no-store" } }
  );
}
