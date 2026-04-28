import { NextResponse } from "next/server";
import { getAuthContext } from "../../_auth";
import { isMaker } from "../../_guard";
import { getAdapter } from "@/web-bridge/adapterRegistry";
import { CreatorWebStateStore } from "@/providers/creatorWebStateStore";
import { getCreatorWebProvider } from "@/providers/creatorWebRegistry";
import { appendCreatorWebTrace } from "@/providers/creatorWebTraceWriter";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const provider = String(searchParams.get("provider") || "");

  if (provider !== "deepseek_web" && provider !== "qwen_web" && provider !== "chatgpt_web") {
    return NextResponse.json({ ok: false, error: "bad_provider" }, { status: 400 });
  }

  const reg = getCreatorWebProvider(provider);
  const adapter = getAdapter(provider as any);
  if (!reg || !adapter) {
    return NextResponse.json({ ok: false, error: "missing_adapter_or_registry" }, { status: 400 });
  }

  const r = await adapter.selfTest();
  const stateStore = new CreatorWebStateStore();
  await stateStore.load();

  if (!r.ok && r.reason === "login_required") {
    stateStore.markReloginRequired(provider, "health_login_required");
    await stateStore.save();

    await appendCreatorWebTrace({
      provider_id: provider,
      source_url: reg.source_url,
      policy_id: reg.policy_id,
      action_type: "relogin_required",
      delay_applied_ms: 0,
      policy_verdict: "blocked",
      meta: { via: "health", reason: "login_required" },
    });

    return NextResponse.json({ ok: false, provider, reason: "login_required" });
  }

  if (r.ok) {
    stateStore.clearRelogin(provider);
    await stateStore.save();
  }

  return NextResponse.json({
    ok: r.ok,
    provider,
    reason: r.ok ? null : r.reason,
    details: r.ok ? r.details : r.details ?? {},
  });
}
