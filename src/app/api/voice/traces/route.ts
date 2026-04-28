import { listVoiceTraces } from "@/server/voice/traceReader";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || "50") || 50;
  const rows = await listVoiceTraces(limit);
  return Response.json(
    { ok: true, traces: rows },
    { headers: { "cache-control": "no-store" } }
  );
}
