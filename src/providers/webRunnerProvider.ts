import { cookies } from "next/headers";
import { getCreatorWebProvider } from "@/providers/creatorWebRegistry";
import { controlCreatorWebAction } from "@/providers/creatorWebController";
import { appendCreatorWebTrace } from "@/providers/creatorWebTraceWriter";
import { CreatorWebStateStore } from "@/providers/creatorWebStateStore";
import { enqueue } from "@/web-bridge/queue";
import { getAdapter } from "@/web-bridge/adapterRegistry";

const COOKIE_PROVIDER = "telegpt_cw_provider";

export async function generateViaSelectedWebProvider(prompt: string): Promise<
  | { ok: true; provider_id: string; answer: string }
  | { ok: false; error: string; provider_id?: string }
> {
  const jar = await cookies();
  const provider_id = jar.get(COOKIE_PROVIDER)?.value ?? "";
  if (!provider_id) return { ok: false, error: "no_provider_selected" };

  const p = getCreatorWebProvider(provider_id);
  if (!p) return { ok: false, error: "unknown_provider", provider_id };
  if (!p.enabled) return { ok: false, error: "provider_disabled", provider_id };

  const verdict = await controlCreatorWebAction({
    provider_id,
    action_type: "send",
  });

  if (verdict.policy_verdict !== "allowed" && verdict.policy_verdict !== "slow_mode") {
    await appendCreatorWebTrace({
      provider_id: p.id,
      source_url: p.source_url,
      policy_id: p.policy_id,
      action_type: "send",
      delay_applied_ms: verdict.delay_applied_ms ?? 0,
      policy_verdict: verdict.policy_verdict,
      meta: { reason: "policy_gate", runner: "webRunnerProvider" },
    });

    return { ok: false, error: `policy_${verdict.policy_verdict}`, provider_id };
  }

  const delayMs = Number(verdict.delay_applied_ms || 0);
  if (delayMs > 0) {
    await appendCreatorWebTrace({
      provider_id: p.id,
      source_url: p.source_url,
      policy_id: p.policy_id,
      action_type: "wait",
      delay_applied_ms: delayMs,
      policy_verdict: verdict.policy_verdict,
      meta: { reason: "policy_delay" },
    });
    await new Promise((r) => setTimeout(r, delayMs));
  }

  const adapter = getAdapter(provider_id as any);
  if (!adapter) return { ok: false, error: "adapter_missing", provider_id };

  const result = await enqueue(provider_id, async () => {
    await appendCreatorWebTrace({
      provider_id: p.id,
      source_url: p.source_url,
      policy_id: p.policy_id,
      action_type: "open",
      delay_applied_ms: 0,
      policy_verdict: "allowed",
      meta: { runner: "webRunnerProvider" },
    });

    const r = await adapter.runChat(prompt);

    if (!r.ok && r.error === "login_required") {
      const stateStore = new CreatorWebStateStore();
      await stateStore.load();
      stateStore.markReloginRequired(p.id, "run_login_required");
      await stateStore.save();

      await appendCreatorWebTrace({
        provider_id: p.id,
        source_url: p.source_url,
        policy_id: p.policy_id,
        action_type: "relogin_required",
        delay_applied_ms: 0,
        policy_verdict: "blocked",
        meta: { via: "run", reason: "login_required" },
      });

      return { ok: false as const, error: "relogin_required" };
    }

    if (!r.ok) {
      await appendCreatorWebTrace({
        provider_id: p.id,
        source_url: p.source_url,
        policy_id: p.policy_id,
        action_type: "read",
        delay_applied_ms: 0,
        policy_verdict: "blocked",
        meta: { runner: "webRunnerProvider", error: r.error, ...r.meta },
      });
      return { ok: false as const, error: r.error };
    }

    await appendCreatorWebTrace({
      provider_id: p.id,
      source_url: p.source_url,
      policy_id: p.policy_id,
      action_type: "read",
      delay_applied_ms: 0,
      policy_verdict: "allowed",
      meta: { runner: "webRunnerProvider", len: r.answer.length },
    });

    return { ok: true as const, answer: r.answer };
  });

  if (!result.ok) return { ok: false, error: result.error, provider_id };
  return { ok: true, provider_id, answer: result.answer };
}
