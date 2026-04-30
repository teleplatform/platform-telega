import type Database from "better-sqlite3";
import type {
  OptimizationCandidate,
  OptimizationTrial,
  OptimizationMetrics,
  OptimizationEvaluation,
  OptimizationRollout,
  OptimizationRollback,
} from "../../runtime-optimization-contracts/src/optimization.js";

export function createCandidatesRepo(db: Database.Database) {
  return {
    saveCandidate(c: OptimizationCandidate): void {
      db.prepare(
        `INSERT OR REPLACE INTO optimization_candidates (candidate_id, proposal_id, intent_type, target_type, target_id, proposed_params_json, created_at, created_by)
         VALUES (@candidate_id, @proposal_id, @intent_type, @target_type, @target_id, @proposed_params_json, @created_at, @created_by)`
      ).run({ ...c, proposed_params_json: JSON.stringify(c.proposed_params) });
    },
    getCandidate(id: string): OptimizationCandidate | null {
      const row = db.prepare("SELECT * FROM optimization_candidates WHERE candidate_id = ?").get(id);
      return row ? { ...(row as any), proposed_params: JSON.parse((row as any).proposed_params_json) } : null;
    },
  };
}

export function createTrialsRepo(db: Database.Database) {
  return {
    saveTrial(t: OptimizationTrial): void {
      db.prepare(
        `INSERT OR REPLACE INTO optimization_trials (trial_id, candidate_id, scope_percentage, scope_segment, duration_ms, started_at, status)
         VALUES (@trial_id, @candidate_id, @scope_percentage, @scope_segment, @duration_ms, @started_at, @status)`
      ).run({
        trial_id: t.trial_id,
        candidate_id: t.candidate_id,
        scope_percentage: t.scope.percentage,
        scope_segment: t.scope.segment ?? null,
        duration_ms: t.duration_ms,
        started_at: t.started_at,
        status: t.status,
      });
    },
    getTrial(id: string): OptimizationTrial | null {
      return db.prepare("SELECT * FROM optimization_trials WHERE trial_id = ?").get(id) as OptimizationTrial | null;
    },
  };
}

export function createMetricsRepo(db: Database.Database) {
  return {
    saveMetrics(m: OptimizationMetrics): void {
      db.prepare(
        `INSERT INTO optimization_metrics (metric_id, trial_id, baseline_json, candidate_json, recorded_at)
         VALUES (@metric_id, @trial_id, @baseline_json, @candidate_json, @recorded_at)`
      ).run({ ...m, baseline_json: JSON.stringify(m.baseline), candidate_json: JSON.stringify(m.candidate) });
    },
    getMetricsByTrial(trial_id: string): OptimizationMetrics[] {
      return db.prepare("SELECT * FROM optimization_metrics WHERE trial_id = ?").all(trial_id) as OptimizationMetrics[];
    },
  };
}

export function createEvaluationsRepo(db: Database.Database) {
  return {
    saveEvaluation(e: OptimizationEvaluation): void {
      db.prepare(
        `INSERT INTO optimization_evaluations (evaluation_id, candidate_id, trial_id, improvement, regression, metrics_diff_json, decision, evaluated_at)
         VALUES (@evaluation_id, @candidate_id, @trial_id, @improvement, @regression, @metrics_diff_json, @decision, @evaluated_at)`
      ).run({
        evaluation_id: e.evaluation_id,
        candidate_id: e.candidate_id,
        trial_id: e.trial_id,
        improvement: e.improvement ? 1 : 0,
        regression: e.regression ? 1 : 0,
        metrics_diff_json: JSON.stringify(e.metrics_diff),
        decision: e.decision,
        evaluated_at: e.evaluated_at,
      });
    },
    getEvaluation(candidate_id: string): OptimizationEvaluation | null {
      return db.prepare("SELECT * FROM optimization_evaluations WHERE candidate_id = ?").get(candidate_id) as OptimizationEvaluation | null;
    },
  };
}

export function createRolloutsRepo(db: Database.Database) {
  return {
    saveRollout(r: OptimizationRollout): void {
      db.prepare(
        `INSERT INTO optimization_rollouts (rollout_id, candidate_id, stage, started_at, status)
         VALUES (@rollout_id, @candidate_id, @stage, @started_at, @status)`
      ).run(r);
    },
    getRolloutByCandidate(candidate_id: string): OptimizationRollout | null {
      return db.prepare("SELECT * FROM optimization_rollouts WHERE candidate_id = ?").get(candidate_id) as OptimizationRollout | null;
    },
  };
}

export function createRollbacksRepo(db: Database.Database) {
  return {
    saveRollback(r: OptimizationRollback): void {
      db.prepare(
        `INSERT INTO optimization_rollbacks (rollback_id, rollout_id, candidate_id, reason, created_at)
         VALUES (@rollback_id, @rollout_id, @candidate_id, @reason, @created_at)`
      ).run(r);
    },
    getRollbackByRollout(rollout_id: string): OptimizationRollback | null {
      return db.prepare("SELECT * FROM optimization_rollbacks WHERE rollout_id = ?").get(rollout_id) as OptimizationRollback | null;
    },
  };
}
