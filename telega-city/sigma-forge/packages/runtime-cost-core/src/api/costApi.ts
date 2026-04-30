import type {
  MissionCostProfile,
  BranchCostEstimate,
  CostDecision,
  CostEnvelope,
  CostVerdict,
  CostSeverity,
  MissionCostClass,
  BusinessValue,
} from "../../runtime-cost-contracts/src/cost.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";
import type { CostRepos } from "../storage/sqlite/costRepo.js";

export interface CostDeps {
  repos: CostRepos;
}

export function createCostApi(deps: CostDeps) {
  const { repos } = deps;

  function estimateBranchCost(input: {
    mission_id: string;
    run_id?: string | null;
    route_key?: string | null;
    orchestration_depth: number;
    estimated_tokens_in?: number | null;
    estimated_tokens_out?: number | null;
    estimated_tool_calls?: number | null;
  }): BranchCostEstimate {
    const tokensIn = input.estimated_tokens_in ?? 0;
    const tokensOut = input.estimated_tokens_out ?? 0;
    const toolCalls = input.estimated_tool_calls ?? 0;
    const depth = input.orchestration_depth;

    const tokenCost = (tokensIn * 0.000002) + (tokensOut * 0.000004);
    const toolCost = toolCalls * 0.005;
    const depthCost = Math.max(0, depth - 1) * 0.01;
    const estimatedCost = Number((tokenCost + toolCost + depthCost).toFixed(6));

    const record: BranchCostEstimate = {
      estimate_id: `est_${randomUUID()}`,
      mission_id: input.mission_id,
      run_id: input.run_id ?? null,
      route_key: input.route_key ?? null,
      estimated_cost_usd: estimatedCost,
      estimated_tokens_in: input.estimated_tokens_in ?? null,
      estimated_tokens_out: input.estimated_tokens_out ?? null,
      estimated_tool_calls: input.estimated_tool_calls ?? null,
      orchestration_depth: input.orchestration_depth,
      estimated_latency_ms: null,
      created_at: nowIso(),
    };
    repos.estimates.save(record);
    return record;
  }

  function classifyMissionCost(estimatedCostUsd: number): MissionCostClass {
    if (estimatedCostUsd > 5) return "critical";
    if (estimatedCostUsd > 1) return "large";
    if (estimatedCostUsd > 0.2) return "medium";
    if (estimatedCostUsd > 0.05) return "small";
    return "tiny";
  }

  function evaluateCostDecision(input: {
    mission_id: string;
    run_id?: string | null;
    mission_type: string;
    department_id?: string | null;
    orchestration_depth: number;
    estimated_cost_usd: number;
    expected_business_value: BusinessValue;
    user_visible: boolean;
    route_key?: string | null;
  }): CostDecision {
    const profile = repos.profiles.getByMissionType(input.mission_type, input.department_id);
    const missionCostClass = classifyMissionCost(input.estimated_cost_usd);
    const reasonCodes: string[] = [];
    const policyRefs: string[] = ["R2_ECONOMICS", "R16_S5_COST_HARDENING"];
    let verdict: CostVerdict = "allow";
    let severity: CostSeverity = "low";

    // Missing profile
    if (!profile) {
      reasonCodes.push("MISSING_COST_PROFILE");
      verdict = "soft_block";
      severity = "high";
      return buildDecision(input, verdict, severity, reasonCodes, policyRefs, null);
    }

    // Orchestration depth
    if (input.orchestration_depth > profile.max_orchestration_depth) {
      reasonCodes.push("ORCHESTRATION_DEPTH_EXCEEDED");
      severity = "high";
    }

    // Hard cap
    if (input.estimated_cost_usd > profile.hard_cap_cost_usd) {
      reasonCodes.push("HARD_CAP_EXCEEDED");
      severity = "critical";
      if (input.expected_business_value === "strategic") {
        reasonCodes.push("STRATEGIC_MISSION_EXCEPTION");
        verdict = "escalate";
      } else {
        verdict = "deny";
      }
      return buildDecision(input, verdict, severity, reasonCodes, policyRefs, profile.confirmation_cost_usd);
    }

    // Low value / high cost mismatch
    if (input.expected_business_value === "low" && (missionCostClass === "large" || missionCostClass === "critical")) {
      reasonCodes.push("LOW_VALUE_HIGH_COST_BRANCH");
      verdict = "deny";
      severity = "high";
      return buildDecision(input, verdict, severity, reasonCodes, policyRefs, profile.confirmation_cost_usd);
    }

    // User-visible expensive branch
    if (profile.require_confirmation_if_user_visible && input.user_visible && input.estimated_cost_usd >= profile.confirmation_cost_usd) {
      reasonCodes.push("USER_VISIBLE_COST_CONFIRMATION_REQUIRED");
      verdict = "require_confirmation";
      severity = "high";
      return buildDecision(input, verdict, severity, reasonCodes, policyRefs, profile.confirmation_cost_usd);
    }

    // Above confirmation threshold
    if (input.estimated_cost_usd >= profile.confirmation_cost_usd) {
      reasonCodes.push("COST_THRESHOLD_EXCEEDED");
      verdict = input.expected_business_value === "strategic" || input.expected_business_value === "high" ? "require_confirmation" : "soft_block";
      severity = "high";
      return buildDecision(input, verdict, severity, reasonCodes, policyRefs, profile.confirmation_cost_usd);
    }

    // Above auto threshold
    if (input.estimated_cost_usd >= profile.max_auto_cost_usd) {
      reasonCodes.push("COST_THRESHOLD_EXCEEDED");
      verdict = "allow_with_audit";
      severity = "medium";
      return buildDecision(input, verdict, severity, reasonCodes, policyRefs, profile.confirmation_cost_usd);
    }

    return buildDecision(input, verdict, severity, reasonCodes, policyRefs, profile.confirmation_cost_usd);
  }

  function buildDecision(input: {
    mission_id: string;
    run_id?: string | null;
    mission_type: string;
    orchestration_depth: number;
    estimated_cost_usd: number;
    expected_business_value: BusinessValue;
    user_visible: boolean;
    route_key?: string | null;
  }, verdict: CostVerdict, severity: CostSeverity, reasonCodes: string[], policyRefs: string[], approvedThreshold: number | null): CostDecision {
    const uniqueReasons = [...new Set(reasonCodes)];
    const explanation = uniqueReasons.length > 0
      ? `Economic evaluation produced ${verdict}: ${uniqueReasons.join(", ")}`
      : `Economic evaluation produced ${verdict}`;

    const decision: CostDecision = {
      decision_id: `cost_${randomUUID()}`,
      cost_eval_id: `eval_${randomUUID()}`,
      verdict,
      severity,
      reason_codes: uniqueReasons,
      policy_refs: policyRefs,
      estimated_cost_usd: input.estimated_cost_usd,
      approved_cost_threshold_usd: approvedThreshold,
      explanation,
      decided_at: nowIso(),
    };

    repos.decisions.save({ ...decision, mission_id: input.mission_id, run_id: input.run_id ?? null, cost_eval_id: decision.cost_eval_id });

    repos.audit.append({
      audit_id: `audit_${randomUUID()}`,
      mission_id: input.mission_id,
      run_id: input.run_id ?? null,
      event_type: "cost_decision_made",
      payload_json: JSON.stringify({ verdict, severity, reason_codes: uniqueReasons, estimated_cost_usd: input.estimated_cost_usd }),
      created_at: nowIso(),
    });

    return decision;
  }

  function evaluateExecutionBranchCost(input: {
    mission_id: string;
    run_id?: string | null;
    mission_type: string;
    department_id?: string | null;
    route_key?: string | null;
    orchestration_depth: number;
    estimated_tokens_in?: number | null;
    estimated_tokens_out?: number | null;
    estimated_tool_calls?: number | null;
    expected_business_value: BusinessValue;
    user_visible: boolean;
  }) {
    const estimate = estimateBranchCost({
      mission_id: input.mission_id,
      run_id: input.run_id,
      route_key: input.route_key,
      orchestration_depth: input.orchestration_depth,
      estimated_tokens_in: input.estimated_tokens_in,
      estimated_tokens_out: input.estimated_tokens_out,
      estimated_tool_calls: input.estimated_tool_calls,
    });

    const decision = evaluateCostDecision({
      mission_id: input.mission_id,
      run_id: input.run_id,
      mission_type: input.mission_type,
      department_id: input.department_id,
      orchestration_depth: input.orchestration_depth,
      estimated_cost_usd: estimate.estimated_cost_usd,
      expected_business_value: input.expected_business_value,
      user_visible: input.user_visible,
      route_key: input.route_key,
    });

    const confirmationPacket = (decision.verdict === "require_confirmation" || decision.verdict === "escalate") ? {
      mission_id: input.mission_id,
      run_id: input.run_id ?? null,
      requested_decision: decision.verdict === "require_confirmation" ? "approve" : "choose_option",
      estimated_cost_usd: decision.estimated_cost_usd,
      approved_cost_threshold_usd: decision.approved_cost_threshold_usd,
      reason_codes: decision.reason_codes,
      explanation: decision.explanation,
    } : null;

    return { estimate, decision, confirmation: confirmationPacket };
  }

  function getMissionCostSummary(missionId: string) {
    const data = repos.audit;
    const profile = repos.profiles.getByMissionType(missionId, null);

    const verdicts = { allow: 0, allow_with_audit: 0, require_confirmation: 0, soft_block: 0, deny: 0, escalate: 0 };

    return {
      mission_id: missionId,
      branch_estimates_count: 0,
      total_estimated_cost_usd: 0,
      highest_branch_cost_usd: 0,
      latest_reason_codes: [] as string[],
      verdicts,
    };
  }

  return {
    estimateBranchCost,
    classifyMissionCost,
    evaluateCostDecision,
    evaluateExecutionBranchCost,
    getMissionCostSummary,
  };
}

export type CostApi = ReturnType<typeof createCostApi>;
