import type {
  CrisisEvent,
  ContinuityModeState,
  SovereignFallbackProfile,
  RecoveryAttemptRecord,
  ResilienceAuditEvent,
  CrisisType,
  CrisisSeverity,
  CrisisScope,
  ContinuityMode,
  CrisisSimulationResult,
  ExternalRecheckRecord,
} from "../../runtime-resilience-contracts/src/resilience.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";

export interface ResilienceDeps {
  crisisEventsRepo: { saveCrisisEvent: (e: CrisisEvent) => void; getCrisisEvent: (id: string) => CrisisEvent | null; getOpenCrises: () => CrisisEvent[] };
  continuityModesRepo: { setMode: (s: ContinuityModeState) => void; getMode: (scope_type: string, scope_id: string) => ContinuityModeState | null };
  recoveryAttemptsRepo: { saveRecovery: (r: RecoveryAttemptRecord) => void; getRecoveryByCrisis: (id: string) => RecoveryAttemptRecord | null };
  resilienceAuditRepo: { appendAudit: (e: ResilienceAuditEvent & { crisis_id?: string }) => void; getAuditTrail: (crisis_id?: string) => ResilienceAuditEvent[] };
  simulationsRepo?: { saveSimulation: (s: CrisisSimulationResult) => void };
  externalRechecksRepo?: { saveRecheck: (r: ExternalRecheckRecord) => void };
}

const SEVERITY_ORDER: Record<CrisisSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export function createResilienceApi(deps: ResilienceDeps) {
  return {
    recordCrisisEvent(input: {
      crisis_type: CrisisType;
      severity: CrisisSeverity;
      affected_scope: CrisisScope;
      affected_ids: string[];
      detected_by: string;
    }): CrisisEvent {
      const event: CrisisEvent = {
        crisis_id: `crisis_${randomUUID()}`,
        crisis_type: input.crisis_type,
        severity: input.severity,
        affected_scope: input.affected_scope,
        affected_ids: input.affected_ids,
        detected_at: nowIso(),
        detected_by: input.detected_by,
        status: "open",
      };
      deps.crisisEventsRepo.saveCrisisEvent(event);
      deps.resilienceAuditRepo.appendAudit({
        crisis_id: event.crisis_id,
        event_type: "crisis_detected",
        actor: input.detected_by,
        details: { crisis_type: event.crisis_type, severity: event.severity, affected_scope: event.affected_scope },
        timestamp: event.detected_at,
      });
      return event;
    },

    declareCrisis(crisis_id: string): { declared: boolean; error?: string } {
      const event = deps.crisisEventsRepo.getCrisisEvent(crisis_id);
      if (!event) return { declared: false, error: "Crisis not found" };
      if (event.status !== "open") return { declared: false, error: `Crisis status is ${event.status}` };
      deps.crisisEventsRepo.saveCrisisEvent({ ...event, status: "contained" });
      deps.resilienceAuditRepo.appendAudit({
        crisis_id,
        event_type: "crisis_declared",
        actor: "system",
        details: { crisis_type: event.crisis_type },
        timestamp: nowIso(),
      });
      return { declared: true };
    },

    activateContinuityMode(input: {
      crisis_id?: string;
      scope_type: CrisisScope;
      scope_id: string;
      mode: ContinuityMode;
      reason: string;
      activated_by: string;
    }): ContinuityModeState {
      const state: ContinuityModeState = {
        scope_type: input.scope_type,
        scope_id: input.scope_id,
        current_mode: input.mode,
        activated_at: nowIso(),
        activated_by: input.activated_by,
        reason: input.reason,
      };
      deps.continuityModesRepo.setMode(state);
      deps.resilienceAuditRepo.appendAudit({
        crisis_id: input.crisis_id,
        event_type: "continuity_mode_activated",
        actor: input.activated_by,
        details: { scope_type: input.scope_type, scope_id: input.scope_id, mode: input.mode, reason: input.reason },
        timestamp: nowIso(),
      });
      return state;
    },

    enterSovereignFallback(input: {
      scope_id: string;
      surviving_capabilities: string[];
      excluded_dependencies: string[];
      local_policy_baseline: string;
      activated_by: string;
    }): SovereignFallbackProfile {
      const profile: SovereignFallbackProfile = {
        profile_id: `fallback_${randomUUID()}`,
        scope_id: input.scope_id,
        surviving_capabilities: input.surviving_capabilities,
        excluded_dependencies: input.excluded_dependencies,
        local_policy_baseline: input.local_policy_baseline,
        execution_classes_active: input.surviving_capabilities,
        execution_classes_frozen: input.excluded_dependencies,
        created_at: nowIso(),
      };
      deps.resilienceAuditRepo.appendAudit({
        event_type: "sovereign_fallback_entered",
        actor: input.activated_by,
        details: { scope_id: input.scope_id, surviving: input.surviving_capabilities.length, excluded: input.excluded_dependencies.length },
        timestamp: nowIso(),
      });
      return profile;
    },

    beginRecoveryAttempt(input: {
      crisis_id: string;
      scope_type: CrisisScope;
      scope_id: string;
    }): RecoveryAttemptRecord {
      const record: RecoveryAttemptRecord = {
        recovery_id: `recovery_${randomUUID()}`,
        crisis_id: input.crisis_id,
        scope_type: input.scope_type,
        scope_id: input.scope_id,
        started_at: nowIso(),
        status: "running",
      };
      deps.recoveryAttemptsRepo.saveRecovery(record);
      deps.resilienceAuditRepo.appendAudit({
        crisis_id: input.crisis_id,
        event_type: "recovery_started",
        actor: "system",
        details: { scope_type: input.scope_type, scope_id: input.scope_id },
        timestamp: nowIso(),
      });
      return record;
    },

    completeRecovery(recovery_id: string, crisis_id: string): { completed: boolean; error?: string } {
      const recovery = deps.recoveryAttemptsRepo.getRecoveryByCrisis(crisis_id);
      if (!recovery || recovery.recovery_id !== recovery_id) return { completed: false, error: "Recovery not found" };
      deps.resilienceAuditRepo.appendAudit({
        crisis_id,
        event_type: "recovery_completed",
        actor: "system",
        details: { recovery_id },
        timestamp: nowIso(),
      });
      return { completed: true };
    },

    rollbackRecovery(recovery_id: string, crisis_id: string, reason: string): { rolled_back: boolean; error?: string } {
      const recovery = deps.recoveryAttemptsRepo.getRecoveryByCrisis(crisis_id);
      if (!recovery || recovery.recovery_id !== recovery_id) return { rolled_back: false, error: "Recovery not found" };
      deps.resilienceAuditRepo.appendAudit({
        crisis_id,
        event_type: "recovery_rolled_back",
        actor: "system",
        details: { recovery_id, reason },
        timestamp: nowIso(),
      });
      return { rolled_back: true };
    },

    getResilienceAuditTrail(crisis_id?: string): ResilienceAuditEvent[] {
      return deps.resilienceAuditRepo.getAuditTrail(crisis_id);
    },

    simulateCrisisScenario(input: {
      scenario_type: CrisisType;
      scope_type: CrisisScope;
      scope_id: string;
      current_capabilities: string[];
      current_dependencies: string[];
      has_local_audit: boolean;
      has_local_policy: boolean;
    }): CrisisSimulationResult {
      const surviving = input.current_capabilities.filter((c) => !input.current_dependencies.includes(c));
      const policy_breach_risks: string[] = [];
      if (!input.has_local_policy) policy_breach_risks.push("no_local_policy_baseline");
      if (input.scenario_type === "federation_disconnect" && !input.current_capabilities.includes("local_routing")) {
        policy_breach_risks.push("local_routing_unavailable_during_federation_disconnect");
      }
      const recovery_ready = input.current_capabilities.includes("local_review") && input.current_capabilities.includes("local_rollback");
      const audit_survivable = input.has_local_audit;
      const continuity_feasible = surviving.length >= 2 && policy_breach_risks.length === 0;

      const result: CrisisSimulationResult = {
        simulation_id: `sim_${randomUUID()}`,
        scenario_type: input.scenario_type,
        scope_type: input.scope_type,
        scope_id: input.scope_id,
        continuity_feasible,
        surviving_capabilities: surviving,
        policy_breach_risks,
        recovery_ready,
        audit_survivable,
        created_at: nowIso(),
      };
      deps.simulationsRepo?.saveSimulation(result);
      deps.resilienceAuditRepo.appendAudit({
        event_type: "crisis_simulation_completed",
        actor: "system",
        details: { scenario_type: input.scenario_type, scope_id: input.scope_id, continuity_feasible, surviving: surviving.length, policy_breach_risks: policy_breach_risks.length },
        timestamp: nowIso(),
      });
      return result;
    },

    recordExternalRecheck(input: {
      crisis_id: string;
      external_party_id: string;
      scope_reenabled: string;
      trust_reverified: boolean;
      compliance_reverified: boolean;
      rechecked_by: string;
    }): ExternalRecheckRecord {
      if (!input.trust_reverified || !input.compliance_reverified) {
        throw new Error("External re-enable requires both trust and compliance reverification");
      }
      const record: ExternalRecheckRecord = {
        recheck_id: `recheck_${randomUUID()}`,
        crisis_id: input.crisis_id,
        external_party_id: input.external_party_id,
        scope_reenabled: input.scope_reenabled,
        trust_reverified: input.trust_reverified,
        compliance_reverified: input.compliance_reverified,
        rechecked_at: nowIso(),
        rechecked_by: input.rechecked_by,
      };
      deps.externalRechecksRepo?.saveRecheck(record);
      deps.resilienceAuditRepo.appendAudit({
        crisis_id: input.crisis_id,
        event_type: "external_scope_reenabled",
        actor: input.rechecked_by,
        details: { external_party_id: input.external_party_id, scope_reenabled: input.scope_reenabled, trust_reverified: true, compliance_reverified: true },
        timestamp: nowIso(),
      });
      return record;
    },

    validateCrisisAuthority(input: {
      action: string;
      actor_roles: string[];
      required_roles: string[];
    }): { authorized: boolean; error?: string } {
      const hasRequired = input.required_roles.some((r) => input.actor_roles.includes(r));
      if (!hasRequired) {
        return { authorized: false, error: `Action ${input.action} requires one of: ${input.required_roles.join(", ")}. Actor has: ${input.actor_roles.join(", ")}` };
      }
      return { authorized: true };
    },
  };
}

export type ResilienceApi = ReturnType<typeof createResilienceApi>;
