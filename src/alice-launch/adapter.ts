// ─────────────────────────────────────────────────────────────
// ALICE EXTERNAL LAUNCH / GO-LIVE PACK v1.0 — Main Handler
//
// prepareAliceExternalLaunch() does ONLY:
// 1. build launch plan
// 2. resolve launch mode
// 3. run gates
// 4. run smoke checks
// 5. decide launch outcome
// 6. build health snapshot
// 7. build hold/rollback path if needed
// 8. never pretend launch already succeeded externally
// ─────────────────────────────────────────────────────────────

import type {
  AliceLaunchPlan,
  AliceGoLiveGateResult,
  AliceLaunchSmokeResult,
  AliceLaunchOutcome,
  AliceLaunchHealthSnapshot,
  AliceRollbackDecision,
} from "./types.js";
import { buildAliceLaunchPlan } from "./plan.js";
import { resolveAliceLaunchMode } from "./modes.js";
import { runAliceGoLiveGates } from "./gates.js";
import { runAliceLaunchSmokeChecks } from "./smoke.js";
import { buildAliceLaunchOutcome } from "./outcomes.js";
import { buildAliceLaunchHealthSnapshot } from "./health.js";
import { buildAliceRollbackDecision } from "./rollback.js";

export type LaunchPrepResult = {
  plan: AliceLaunchPlan;
  resolvedMode: ReturnType<typeof resolveAliceLaunchMode>;
  gates: AliceGoLiveGateResult;
  smoke: AliceLaunchSmokeResult;
  outcome: AliceLaunchOutcome;
  health: AliceLaunchHealthSnapshot;
  rollbackDecision: AliceRollbackDecision;
};

export function prepareAliceExternalLaunch(input?: {
  mode?: AliceLaunchPlan["mode"];
  requiresReadinessPass?: boolean;
  requiresSmokePass?: boolean;
  allowsRollback?: boolean;
  gates?: {
    publishReadinessPassed?: boolean;
    endpointDeclared?: boolean;
    ingressHardeningEnabled?: boolean;
    protocolAdapterReady?: boolean;
    webhookRouteReady?: boolean;
  };
  smoke?: {
    ingressReachable?: boolean;
    protocolMappingWorks?: boolean;
    bridgeAdapterWorks?: boolean;
    safeErrorPathWorks?: boolean;
  };
}): LaunchPrepResult {
  // 1. Build launch plan
  const plan = buildAliceLaunchPlan({
    mode: input?.mode,
    requiresReadinessPass: input?.requiresReadinessPass,
    requiresSmokePass: input?.requiresSmokePass,
    allowsRollback: input?.allowsRollback,
  });

  // 2. Run gates first (needed for mode resolution)
  const gates = runAliceGoLiveGates(input?.gates);

  // 3. Run smoke checks (needed for mode resolution)
  const smoke = runAliceLaunchSmokeChecks(input?.smoke);

  // 4. Resolve launch mode based on gate/smoke results
  const resolvedMode = resolveAliceLaunchMode({
    mode: input?.mode,
    gatesPassed: gates.gatesPassed,
    smokePassed: smoke.smokePassed,
  });

  // Update plan with resolved mode
  const effectivePlan: AliceLaunchPlan = { ...plan, mode: resolvedMode };

  // 5. Decide launch outcome
  const outcome = buildAliceLaunchOutcome({
    plan: effectivePlan,
    gates,
    smoke,
  });

  // 6. Build health snapshot
  const health = buildAliceLaunchHealthSnapshot({
    launchState: outcome.launchState,
    gatesPassed: gates.gatesPassed,
    smokePassed: smoke.smokePassed,
  });

  // 7. Build rollback decision if needed
  const rollbackDecision = buildAliceRollbackDecision({
    launchState: outcome.launchState,
    reason: outcome.reason,
    notes: outcome.notes,
  });

  // 8. Return — launch has NOT been externally executed
  return {
    plan: effectivePlan,
    resolvedMode,
    gates,
    smoke,
    outcome,
    health,
    rollbackDecision,
  };
}
