import crypto from "node:crypto";
import { db } from "../db.ts";
import { writeTrace } from "../traces/writeTrace.ts";
import { ensureDefaultLrlRules } from "./lrlRules.ts";

type LrlEvent = {
  id: string;
  type: string;
  user_id: string;
  payload_json: string;
  payload_hash: string;
  status: string;
  blocked_reason?: string | null;
  created_at: string;
};

export async function lrlRunnerOnce(limit = 50) {
  ensureDefaultLrlRules();

  const queued = db.lrl.listQueuedEvents(limit) as LrlEvent[];
  let processed = 0;
  let blocked = 0;
  let awarded_total = 0;

  for (const ev of queued) {
    const now = new Date().toISOString();
    const payload = safeJson(ev.payload_json);
    const rules = db.lrl.listRulesByType(ev.type);

    if (rules.length === 0) {
      db.lrl.updateEventStatus({ id: ev.id, status: "blocked", blocked_reason: "no_rule", processed_at: now });
      blocked++;
      await writeTrace({
        ok: false,
        route: "/v1/lrl/run-once",
        provider: "core",
        lrl_event_type: ev.type,
        lrl_event_id: ev.id,
        award_teleton: 0,
        award_bonus: 0,
        wallet_teleton_delta_applied: 0,
        wallet_bonus_delta_applied: 0,
        fraud_flags_count: 0,
        action_map_id: null,
        meta: { reason: "no_rule" },
      });
      continue;
    }

    const fraud_flags: string[] = [];
    const spike = await isRateSpike(ev.user_id, 10, 10);
    if (spike) fraud_flags.push("RATE_SPIKE");

    const caps = computeAwards(ev.user_id, rules);
    let awardTeleton = caps.awardTeleton;
    let awardBonus = caps.awardBonus;

    if (caps.cap_hit) fraud_flags.push("CAP_HIT");

    const reviewGate = handleReviewGate(ev, payload);
    const action_map_id = reviewGate?.action_map_id ?? null;

    let teletonApplied = 0;
    let bonusApplied = 0;

    if (awardTeleton !== 0) {
      const ok = tryInsertLedger(ev, "teleton", awardTeleton, ev.type);
      if (!ok) {
        fraud_flags.push("DUPLICATE_EVENT");
        awardTeleton = 0;
      } else {
        teletonApplied = awardTeleton;
      }
    }

    if (awardBonus !== 0) {
      const ok = tryInsertLedger(ev, "bonus", awardBonus, ev.type);
      if (!ok) {
        fraud_flags.push("DUPLICATE_EVENT");
        awardBonus = 0;
      } else {
        bonusApplied = awardBonus;
      }
    }

    if (teletonApplied || bonusApplied) {
      updateWallet(ev.user_id, teletonApplied, bonusApplied);
      awarded_total += teletonApplied + bonusApplied;
    }

    db.lrl.updateEventStatus({ id: ev.id, status: "processed", processed_at: now });
    processed++;

    await writeTrace({
      ok: true,
      route: "/v1/lrl/run-once",
      provider: "core",
      lrl_event_type: ev.type,
      lrl_event_id: ev.id,
      award_teleton: awardTeleton,
      award_bonus: awardBonus,
      wallet_teleton_delta_applied: teletonApplied,
      wallet_bonus_delta_applied: bonusApplied,
      fraud_flags_count: fraud_flags.length,
      action_map_id,
      meta: {
        user_id: ev.user_id,
        fraud_flags,
        review_gate: reviewGate ?? null,
      },
    });
  }

  return { processed, blocked, awarded_total };
}

function safeJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function computeAwards(user_id: string, rules: Array<any>) {
  let awardTeleton = 0;
  let awardBonus = 0;
  let cap_hit = false;

  const dayIso = new Date().toISOString();
  const currentTeleton = db.lrl.sumLedgerForDay({ user_id, asset: "teleton", dayIso });
  const currentBonus = db.lrl.sumLedgerForDay({ user_id, asset: "bonus", dayIso });

  for (const rule of rules) {
    let t = Number(rule.award_teleton || 0);
    let b = Number(rule.award_bonus || 0);

    if (rule.daily_cap_teleton > 0) {
      const remaining = rule.daily_cap_teleton - currentTeleton - awardTeleton;
      if (remaining <= 0) {
        t = 0;
        cap_hit = true;
      } else if (t > remaining) {
        t = remaining;
        cap_hit = true;
      }
    }

    if (rule.daily_cap_bonus > 0) {
      const remaining = rule.daily_cap_bonus - currentBonus - awardBonus;
      if (remaining <= 0) {
        b = 0;
        cap_hit = true;
      } else if (b > remaining) {
        b = remaining;
        cap_hit = true;
      }
    }

    awardTeleton += t;
    awardBonus += b;
  }

  return { awardTeleton, awardBonus, cap_hit };
}

function tryInsertLedger(ev: LrlEvent, asset: "teleton" | "bonus", delta: number, reason: string) {
  try {
    db.lrl.insertLedger({
      id: crypto.randomUUID(),
      user_id: ev.user_id,
      asset,
      delta,
      reason,
      event_id: ev.id,
      created_at: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

function updateWallet(user_id: string, deltaTeleton: number, deltaBonus: number) {
  const current = db.lrl.getWallet(user_id);
  const teleton = (current?.teleton_balance ?? 0) + deltaTeleton;
  const bonus = (current?.bonus_points_balance ?? 0) + deltaBonus;
  db.lrl.upsertWallet({
    user_id,
    teleton_balance: teleton,
    bonus_points_balance: bonus,
    updated_at: new Date().toISOString(),
  });
}

function handleReviewGate(ev: LrlEvent, payload: any) {
  if (ev.type !== "review.left") return null;
  const stars = Number(payload?.stars ?? payload?.rating ?? 0);
  const visibility = stars <= 3 ? "private" : "public";
  db.lrl.insertReviewGate({
    review_id: String(payload?.review_id ?? ev.id),
    stars,
    visibility,
    created_at: new Date().toISOString(),
  });

  return {
    action_map_id: visibility === "private" ? "am_review_support_v1" : "am_review_thanks_v1",
    visibility,
  };
}

async function isRateSpike(user_id: string, minutes: number, limit: number) {
  try {
    const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    const items = db.lrl.listQueuedEvents(200).filter((e) => e.user_id === user_id && e.created_at >= since);
    return items.length > limit;
  } catch {
    return false;
  }
}
