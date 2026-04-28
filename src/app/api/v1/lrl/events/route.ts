import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/core/db";
import { writeTrace } from "@/core/traces/writeTrace";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const type = String(body?.type || "");
  const user_id = String(body?.user_id || "");
  const payload = body?.payload ?? {};

  if (!type || !user_id) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const payload_json = JSON.stringify(payload);
  const payload_hash = crypto.createHash("sha256").update(payload_json).digest("hex");
  const event_id = String(body?.id || crypto.randomUUID());

  const recent = recentUserEvents(user_id, 10, 10);
  if (recent) {
    await writeTrace({
      ok: false,
      route: "/v1/lrl/events",
      provider: "core",
      lrl_event_type: type,
      lrl_event_id: null,
      award_teleton: 0,
      award_bonus: 0,
      wallet_teleton_delta_applied: 0,
      wallet_bonus_delta_applied: 0,
      fraud_flags_count: 1,
      action_map_id: null,
      meta: { user_id, reason: "RATE_SPIKE" },
    });
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  try {
    db.lrl.insertEvent({
      id: event_id,
      type,
      user_id,
      payload_json,
      payload_hash,
      status: "queued",
      created_at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "duplicate_event" }, { status: 409 });
  }

  await writeTrace({
    ok: true,
    route: "/v1/lrl/events",
    provider: "core",
    lrl_event_type: type,
    lrl_event_id: event_id,
    award_teleton: 0,
    award_bonus: 0,
    wallet_teleton_delta_applied: 0,
    wallet_bonus_delta_applied: 0,
    fraud_flags_count: 0,
    action_map_id: null,
    meta: { user_id },
  });

  return NextResponse.json({ ok: true, event_id });
}

function recentUserEvents(user_id: string, minutes: number, limit: number) {
  try {
    const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    const items = db.lrl.listQueuedEvents(200) as Array<{ user_id: string; created_at: string }>;
    const count = items.filter((e) => e.user_id === user_id && e.created_at >= since).length;
    return count >= limit;
  } catch {
    return false;
  }
}
