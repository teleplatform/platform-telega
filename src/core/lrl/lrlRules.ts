import crypto from "node:crypto";
import { db } from "../db.ts";

export type LrlRule = {
  id: string;
  version: number;
  enabled: number;
  event_type: string;
  award_teleton: number;
  award_bonus: number;
  daily_cap_teleton: number;
  daily_cap_bonus: number;
  conditions_json: string;
  updated_at: string;
};

const DEFAULT_RULES: Array<Omit<LrlRule, "id" | "version" | "enabled" | "updated_at">> = [
  {
    event_type: "order.paid",
    award_teleton: 0,
    award_bonus: 50,
    daily_cap_teleton: 0,
    daily_cap_bonus: 200,
    conditions_json: "{}",
  },
  {
    event_type: "service.booked",
    award_teleton: 0,
    award_bonus: 20,
    daily_cap_teleton: 0,
    daily_cap_bonus: 200,
    conditions_json: "{}",
  },
  {
    event_type: "review.left",
    award_teleton: 0,
    award_bonus: 10,
    daily_cap_teleton: 0,
    daily_cap_bonus: 50,
    conditions_json: "{}",
  },
  {
    event_type: "referral.joined",
    award_teleton: 1,
    award_bonus: 100,
    daily_cap_teleton: 5,
    daily_cap_bonus: 300,
    conditions_json: "{}",
  },
  {
    event_type: "user.returned_after_7_days",
    award_teleton: 0,
    award_bonus: 30,
    daily_cap_teleton: 0,
    daily_cap_bonus: 100,
    conditions_json: "{}",
  },
];

export function ensureDefaultLrlRules() {
  const existing = db.lrl.listRules();
  if (existing.length > 0) return;

  const now = new Date().toISOString();
  for (const rule of DEFAULT_RULES) {
    db.lrl.insertRule({
      id: crypto.randomUUID(),
      version: 1,
      enabled: 1,
      event_type: rule.event_type,
      award_teleton: rule.award_teleton,
      award_bonus: rule.award_bonus,
      daily_cap_teleton: rule.daily_cap_teleton,
      daily_cap_bonus: rule.daily_cap_bonus,
      conditions_json: rule.conditions_json,
      updated_at: now,
    });
  }
}
