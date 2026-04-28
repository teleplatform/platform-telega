import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const { voice_id, text } = body ?? {};

  const base =
    process.env.TELEGPT_COSYVOICE_BASE_URL || "http://127.0.0.1:7788";
  const r = await fetch(`${base}/tts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ voice_id, text }),
  });

  if (!r.ok) {
    const t = await r.text();
    return NextResponse.json({ ok: false, error: t }, { status: 500 });
  }

  const data = await r.json();
  return NextResponse.json({ ok: true, ...data });
}
