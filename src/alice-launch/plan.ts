// ─────────────────────────────────────────────────────────────
// ALICE EXTERNAL LAUNCH / GO-LIVE PACK v1.0 — Launch Plan
//
// Formal launch contract describing:
// - launchId, skillId
// - mode (dry_run, internal_only, controlled_live)
// - target surface
// - readiness/smoke requirements
// - rollback allowance
// ─────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type { AliceLaunchPlan } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function buildAliceLaunchPlan(input?: {
  launchId?: string;
  mode?: AliceLaunchPlan["mode"];
  targetSurface?: AliceLaunchPlan["targetSurface"];
  requiresReadinessPass?: boolean;
  requiresSmokePass?: boolean;
  allowsRollback?: boolean;
  notes?: string[];
}): AliceLaunchPlan {
  return {
    launchId: input?.launchId ?? crypto.randomUUID(),
    skillId: "arisha_alice_skill_v1",
    mode: input?.mode ?? "dry_run",
    targetSurface: input?.targetSurface ?? "alice",
    requiresReadinessPass: input?.requiresReadinessPass ?? true,
    requiresSmokePass: input?.requiresSmokePass ?? true,
    allowsRollback: input?.allowsRollback ?? true,
    createdAt: nowIso(),
    notes: input?.notes,
  };
}

export function serializeAliceLaunchPlan(plan: AliceLaunchPlan): string {
  return JSON.stringify(plan, null, 2);
}

export function parseAliceLaunchPlan(json: string): AliceLaunchPlan | null {
  try {
    const parsed = JSON.parse(json) as AliceLaunchPlan;
    if (parsed.skillId !== "arisha_alice_skill_v1") return null;
    if (!["dry_run", "internal_only", "controlled_live"].includes(parsed.mode)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getDefaultLaunchPlan(): AliceLaunchPlan {
  return buildAliceLaunchPlan();
}
