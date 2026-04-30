import type {
  ControlSurface,
  HumanGovernanceAction,
  LegibilityDigest,
  TruthViewDescriptor,
  GuardedWriteActionPolicy,
  DecisionDigest,
  OperatorInterventionRequest,
  ControlAuditEvent,
} from "../../runtime-control-contracts/src/control.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";
import type { ControlRepos } from "../storage/sqlite/controlRepo.js";

export interface ControlDeps {
  repos: ControlRepos;
}

export function createControlApi(deps: ControlDeps) {
  const { repos } = deps;

  return {
    createControlSurface(input: {
      surface_type: ControlSurface["surface_type"];
      title: string;
      allowed_views: string[];
      allowed_actions: string[];
      required_role_map: Record<string, string[]>;
    }): ControlSurface {
      const surface: ControlSurface = {
        surface_id: `surface_${randomUUID()}`,
        surface_type: input.surface_type,
        title: input.title,
        allowed_views: input.allowed_views,
        allowed_actions: input.allowed_actions,
        required_role_map: input.required_role_map,
        status: "active",
        created_at: nowIso(),
      };
      repos.surfaces.save(surface);
      repos.audit.append({
        event_type: "control_surface_created",
        actor_id: "system",
        actor_role: "system",
        target_type: "surface",
        target_id: surface.surface_id,
        details: { surface_type: surface.surface_type, title: surface.title },
        timestamp: nowIso(),
      });
      return surface;
    },

    setupGuardedActionPolicy(input: {
      action_type: string;
      required_roles: string[];
      confirmation_mode: GuardedWriteActionPolicy["confirmation_mode"];
      blocked_if_constraints: string[];
    }): GuardedWriteActionPolicy {
      const policy: GuardedWriteActionPolicy = {
        policy_id: `policy_${randomUUID()}`,
        action_type: input.action_type,
        required_roles: input.required_roles,
        confirmation_mode: input.confirmation_mode,
        blocked_if_constraints: input.blocked_if_constraints,
      };
      repos.guardedPolicies.save(policy);
      return policy;
    },

    getTruthView(input: {
      view_type: string;
      scope_type: string;
      scope_id: string;
      state_summary: string;
      provenance_refs: string[];
      active_constraints: string[];
      recent_decisions: string[];
    }): TruthViewDescriptor {
      const view: TruthViewDescriptor = {
        view_id: `view_${randomUUID()}`,
        view_type: input.view_type,
        scope_type: input.scope_type,
        scope_id: input.scope_id,
        state_summary: input.state_summary,
        provenance_refs: input.provenance_refs,
        active_constraints: input.active_constraints,
        recent_decisions: input.recent_decisions,
        generated_at: nowIso(),
      };
      repos.truthViews.save(view);
      repos.audit.append({
        event_type: "truth_view_generated",
        actor_id: "system",
        actor_role: "system",
        target_type: "view",
        target_id: view.view_id,
        details: { view_type: view.view_type, scope_id: view.scope_id },
        timestamp: nowIso(),
      });
      return view;
    },

    generateLegibilityDigest(input: {
      target_type: string;
      target_id: string;
      summary: string;
      evidence_refs: string[];
      active_constraints: string[];
      pending_actions: string[];
      risk_flags: string[];
    }): { digest: LegibilityDigest; error?: string } {
      if (input.evidence_refs.length === 0) {
        return { digest: {} as LegibilityDigest, error: "Legibility digest requires evidence refs" };
      }
      const digest: LegibilityDigest = {
        digest_id: `digest_${randomUUID()}`,
        target_type: input.target_type,
        target_id: input.target_id,
        summary: input.summary,
        evidence_refs: input.evidence_refs,
        active_constraints: input.active_constraints,
        pending_actions: input.pending_actions,
        risk_flags: input.risk_flags,
        generated_at: nowIso(),
      };
      repos.digests.save(digest);
      return { digest };
    },

    requestDecisionDigest(input: {
      digest_type: string;
      scope_type: string;
      scope_id: string;
      title: string;
      summary: string;
      what_changed: string[];
      what_blocked: string[];
      next_actions: string[];
      what_not_to_touch: string[];
      trace_refs: string[];
    }): { digest: DecisionDigest; error?: string } {
      if (input.trace_refs.length === 0) {
        return { digest: {} as DecisionDigest, error: "Decision digest requires trace refs" };
      }
      const digest: DecisionDigest = {
        digest_id: `ddigest_${randomUUID()}`,
        digest_type: input.digest_type,
        scope_type: input.scope_type,
        scope_id: input.scope_id,
        title: input.title,
        summary: input.summary,
        what_changed: input.what_changed,
        what_blocked: input.what_blocked,
        next_actions: input.next_actions,
        what_not_to_touch: input.what_not_to_touch,
        trace_refs: input.trace_refs,
        generated_at: nowIso(),
      };
      repos.decisionDigests.save(digest);
      return { digest };
    },

    validateHumanGovernanceAction(input: {
      action_type: string;
      actor_role: string;
      risk_class: HumanGovernanceAction["risk_class"];
    }): { valid: boolean; error?: string } {
      const policy = repos.guardedPolicies.getByAction(input.action_type);
      if (!policy) return { valid: true }; // no policy = allowed (read actions typically)
      if (!policy.required_roles.includes(input.actor_role)) {
        return { valid: false, error: `Action ${input.action_type} requires one of: ${policy.required_roles.join(", ")}` };
      }
      return { valid: true };
    },

    executeGuardedWriteAction(input: {
      action_type: string;
      target_type: string;
      target_id: string;
      actor_id: string;
      actor_role: string;
      crisis_authority?: { has_crisis_authority: boolean; required_roles: string[] };
      external_recheck?: { has_valid_recheck: boolean; recheck_id?: string };
    }): { executed: boolean; error?: string } {
      // Crisis authority guard
      if (input.action_type.startsWith("declare_crisis") || input.action_type.startsWith("activate_crisis") || input.action_type.startsWith("crisis_") || input.action_type === "enter_sovereign_fallback") {
        if (input.crisis_authority && !input.crisis_authority.has_crisis_authority) {
          return { executed: false, error: `Crisis action ${input.action_type} requires crisis authority. Required roles: ${input.crisis_authority.required_roles.join(", ")}` };
        }
      }

      // External recheck guard
      if (input.action_type.startsWith("reenable_external") || input.action_type.startsWith("restore_external") || input.action_type.startsWith("external_reenable") || input.action_type === "restore_external_access") {
        if (!input.external_recheck || !input.external_recheck.has_valid_recheck) {
          return { executed: false, error: `External re-enable action ${input.action_type} requires valid recheck proof` };
        }
      }

      const validation = this.validateHumanGovernanceAction({
        action_type: input.action_type,
        actor_role: input.actor_role,
        risk_class: "high",
      });
      if (!validation.valid) return { executed: false, error: validation.error };

      const action: HumanGovernanceAction = {
        action_id: `action_${randomUUID()}`,
        action_type: input.action_type,
        target_type: input.target_type,
        target_id: input.target_id,
        actor_id: input.actor_id,
        actor_role: input.actor_role,
        mode: "write",
        risk_class: "high",
        created_at: nowIso(),
      };
      repos.actions.save(action);
      repos.audit.append({
        event_type: "guarded_action_executed",
        actor_id: input.actor_id,
        actor_role: input.actor_role,
        target_type: input.target_type,
        target_id: input.target_id,
        details: { action_type: input.action_type },
        timestamp: nowIso(),
      });
      return { executed: true };
    },

    requestOperatorIntervention(input: {
      action_type: string;
      target_type: string;
      target_id: string;
      actor_id: string;
      reason: string;
      risk_class: OperatorInterventionRequest["risk_class"];
    }): OperatorInterventionRequest {
      const intervention: OperatorInterventionRequest = {
        intervention_id: `intervention_${randomUUID()}`,
        action_type: input.action_type,
        target_type: input.target_type,
        target_id: input.target_id,
        actor_id: input.actor_id,
        reason: input.reason,
        risk_class: input.risk_class,
        status: "requested",
        created_at: nowIso(),
      };
      repos.interventions.save(intervention);
      repos.audit.append({
        event_type: "operator_intervention_requested",
        actor_id: input.actor_id,
        actor_role: "operator",
        target_type: input.target_type,
        target_id: input.target_id,
        details: { action_type: input.action_type, reason: input.reason },
        timestamp: nowIso(),
      });
      return intervention;
    },

    applyOperatorIntervention(intervention_id: string, applied_by: string): { applied: boolean; error?: string } {
      // In a real system this would transition state; here we audit the application
      repos.audit.append({
        event_type: "operator_intervention_applied",
        actor_id: applied_by,
        actor_role: "operator",
        target_type: "intervention",
        target_id: intervention_id,
        details: { intervention_id },
        timestamp: nowIso(),
      });
      return { applied: true };
    },

    getControlAuditTrail(actor_id?: string): ControlAuditEvent[] {
      return repos.audit.getTrail(actor_id);
    },
  };
}

export type ControlApi = ReturnType<typeof createControlApi>;
