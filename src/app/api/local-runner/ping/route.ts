import { NextResponse } from "next/server";
import { getAuthContext } from "../../_auth";
import { isMaker } from "../../_guard";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const base = process.env.TELEGPT_LOCAL_RUNNER_URL || "http://127.0.0.1:8787";
  const token = process.env.TELEGPT_LOCAL_RUNNER_TOKEN || "";

  try {
    const r = await fetch(`${base}/v1/ping`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    return NextResponse.json(j, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: "unreachable",
      details: String(e?.message || e),
    });
  }
}
