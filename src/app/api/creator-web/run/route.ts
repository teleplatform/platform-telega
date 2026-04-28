import { NextResponse } from "next/server";
import { getAuthContext } from "../../_auth";
import { isMaker } from "../../_guard";
import { generateViaSelectedWebProvider } from "@/providers/webRunnerProvider";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const prompt = String(body?.prompt ?? "").trim();

  if (!prompt) return NextResponse.json({ ok: false, error: "empty_prompt" }, { status: 400 });

  const r = await generateViaSelectedWebProvider(prompt);

  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json(r);
}
