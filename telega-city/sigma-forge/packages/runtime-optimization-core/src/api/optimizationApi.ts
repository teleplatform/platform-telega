import type {
  OptimizationCandidate,
  OptimizationTrial,
  OptimizationMetrics,
  OptimizationEvaluation,
  OptimizationRollout,
  OptimizationRollback,
  OptimizationAuditEvent,
  TrialDecision,
  RolloutStage,
  RolloutStatus,
} from "../../runtime-optimization-contracts/src/optimization.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";

export interface OptimizationDeps {
  candidatesRepo: { saveCandidate: (c: OptimizationCandidate) => void; getCandidate: (id: string) => OptimizationCandidate | null };
  trialsRepo: { saveTrial: (t: OptimizationTrial) => void; getTrial: (id: string) => OptimizationTrial | null };
  metricsRepo: { saveMetrics: (m: OptimizationMetrics) => void; getMetricsByTrial: (trial_id: string) => OptimizationMetrics[] };
  evaluationsRepo: { saveEvaluation: (e: OptimizationEvaluation) => void; getEvaluation: (candidate_id: string) => OptimizationEvaluation | null };
  rolloutsRepo: { saveRollout: (r: OptimizationRollout) => void; getRolloutByCandidate: (candidate_id: string) => OptimizationRollout | null };
  rollbacksRepo: { saveRollback: (r: OptimizationRollback) => void; getRollbackByRollout: (rollout_id: string) => OptimizationRollback | null };
}

export function createOptimizationApi(deps: OptimizationDeps) {
  return {
    createOptimizationCandidate(input: {
      proposal_id: string;
      intent_type: OptimizationCandidate["intent_type"];
      target_type: string;
      target_id: string;
      proposed_params: Record<string, unknown>;
      created_by: string;
    }): OptimizationCandidate {
      if (!input.proposal_id) throw new Error("Optimization candidate requires R6 proposal_id");
      const candidate: OptimizationCandidate = {
        candidate_id: `opt_${randomUUID()}`,
        proposal_id: input.proposal_id,
        intent_type: input.intent_type,
        target_type: input.target_type,
        target_id: input.target_id,
        proposed_params: input.proposed_params,
        created_at: nowIso(),
        created_by: input.created_by,
      };
      deps.candidatesRepo.saveCandidate(candidate);
      return candidate;
    },

    startOptimizationTrial(input: {
      candidate_id: string;
      scope_percentage: number;
      scope_segment?: string;
      duration_ms: number;
    }): { trial: OptimizationTrial; baseline: Record<string, number> } {
      const candidate = deps.candidatesRepo.getCandidate(input.candidate_id);
      if (!candidate) throw new Error("Candidate not found");
      if (input.scope_percentage <= 0 || input.scope_percentage > 100) throw new Error("Trial scope must be > 0 and <= 100");

      const baseline: Record<string, number> = { success_rate: 0.8, failure_rate: 0.2, recovery_success_rate: 0.7, fallback_frequency: 0.3, retry_count: 2, latency: 1000, timeout_rate: 0.05, manual_takeover_rate: 0.1 };

      const trial: OptimizationTrial = {
        trial_id: `trial_${randomUUID()}`,
        candidate_id: input.candidate_id,
        scope: { percentage: input.scope_percentage, segment: input.scope_segment },
        duration_ms: input.duration_ms,
        started_at: nowIso(),
        status: "running",
      };
      deps.trialsRepo.saveTrial({ ...trial, scope_percentage: input.scope_percentage, scope_segment: input.scope_segment } as any);
      return { trial, baseline };
    },

    recordOptimizationMetrics(input: {
      trial_id: string;
      baseline: Record<string, number>;
      candidate: Record<string, number>;
    }): OptimizationMetrics {
      const metrics: OptimizationMetrics = {
        metric_id: `metric_${randomUUID()}`,
        trial_id: input.trial_id,
        baseline: input.baseline,
        candidate: input.candidate,
        recorded_at: nowIso(),
      };
      deps.metricsRepo.saveMetrics(metrics);
      return metrics;
    },

    evaluateOptimizationTrial(input: {
      candidate_id: string;
      trial_id: string;
      metrics: { baseline: Record<string, number>; candidate: Record<string, number> };
    }): OptimizationEvaluation {
      const { baseline, candidate } = input.metrics;
      const metrics_diff: Record<string, number> = {};
      let improvement = false;
      let regression = false;

      for (const key of new Set([...Object.keys(baseline), ...Object.keys(candidate)])) {
        const diff = (candidate[key] ?? 0) - (baseline[key] ?? 0);
        metrics_diff[key] = Math.round(diff * 1000) / 1000;
      }

      // Determine improvement/regression based on key metrics
      const successDiff = metrics_diff.success_rate ?? 0;
      const failureDiff = metrics_diff.failure_rate ?? 0;
      const latencyDiff = metrics_diff.latency ?? 0;

      if (successDiff > 0.01 || (failureDiff < -0.01 && latencyDiff < 100)) improvement = true;
      if (failureDiff > 0.05 || (successDiff < -0.05)) regression = true;

      let decision: TrialDecision = "reject";
      if (improvement && !regression) decision = "accept";
      else if (regression) decision = "reject";
      else decision = "extend";

      const evaluation: OptimizationEvaluation = {
        evaluation_id: `eval_${randomUUID()}`,
        candidate_id: input.candidate_id,
        trial_id: input.trial_id,
        improvement,
        regression,
        metrics_diff,
        decision,
        evaluated_at: nowIso(),
      };
      deps.evaluationsRepo.saveEvaluation(evaluation);
      return evaluation;
    },

    acceptOptimizationCandidate(candidate_id: string): { accepted: boolean; error?: string } {
      const evaluation = deps.evaluationsRepo.getEvaluation(candidate_id);
      if (!evaluation) return { accepted: false, error: "No evaluation found" };
      if (evaluation.decision !== "accept") return { accepted: false, error: `Evaluation decision is ${evaluation.decision}, not accept` };
      return { accepted: true };
    },

    rejectOptimizationCandidate(candidate_id: string): { rejected: boolean; error?: string } {
      const evaluation = deps.evaluationsRepo.getEvaluation(candidate_id);
      if (!evaluation) return { rejected: false, error: "No evaluation found" };
      return { rejected: true };
    },

    rolloutAcceptedOptimization(input: {
      candidate_id: string;
      stage: RolloutStage;
    }): { rollout: OptimizationRollout; error?: string } {
      const evaluation = deps.evaluationsRepo.getEvaluation(input.candidate_id);
      if (!evaluation) return { rollout: {} as any, error: "No evaluation found" };
      if (evaluation.decision !== "accept") return { rollout: {} as any, error: "Candidate not accepted" };

      const rollout: OptimizationRollout = {
        rollout_id: `rollout_${randomUUID()}`,
        candidate_id: input.candidate_id,
        stage: input.stage,
        started_at: nowIso(),
        status: "running",
      };
      deps.rolloutsRepo.saveRollout(rollout);
      return { rollout };
    },

    rollbackOptimizationRollout(input: {
      rollout_id: string;
      candidate_id: string;
      reason: string;
    }): { rollback: OptimizationRollback; error?: string } {
      const rollback: OptimizationRollback = {
        rollback_id: `rollback_${randomUUID()}`,
        rollout_id: input.rollout_id,
        candidate_id: input.candidate_id,
        reason: input.reason,
        created_at: nowIso(),
      };
      deps.rollbacksRepo.saveRollback(rollback);
      return { rollback };
    },

    getOptimizationAuditTrail(candidate_id: string): OptimizationAuditEvent[] {
      const events: OptimizationAuditEvent[] = [];
      const candidate = deps.candidatesRepo.getCandidate(candidate_id);
      if (candidate) {
        events.push({ event_type: "candidate_created", actor: candidate.created_by, details: { intent_type: candidate.intent_type, target_id: candidate.target_id }, timestamp: candidate.created_at });
      }
      // Add more events from repos as needed
      return events;
    },
  };
}

export type OptimizationApi = ReturnType<typeof createOptimizationApi>;
