import type {
  HandoffPacket,
  HumanDecision,
  ResumeContract,
  HitlAuditEvent,
  HandoffType,
  RequestedDecision,
  HumanDecisionType,
  ResumeMode,
} from "../../runtime-hitl-contracts/src/hitl.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";
import type { HitlRepos } from "../storage/sqlite/hitlRepo.js";

export interface HitlDeps {
  repos: HitlRepos;
}

export function createHitlApi(deps: HitlDeps) {
  const { repos } = deps;

  return {
    createHandoff(input: {
      mission_id: string;
      run_id?: string;
      action_id?: string;
      department_id?: string;
      handoff_type: HandoffType;
      reason_code: string;
      summary: string;
      requested_decision: RequestedDecision;
      options_json?: string;
      recommended_option?: string;
      paused_stage: string;
      decision_ttl_at?: string;
    }): HandoffPacket {
      const handoff: HandoffPacket = {
        handoff_id: `handoff_${randomUUID()}`,
        mission_id: input.mission_id,
        run_id: input.run_id,
        action_id: input.action_id,
        department_id: input.department_id,
        handoff_type: input.handoff_type,
        reason_code: input.reason_code,
        summary: input.summary,
        requested_decision: input.requested_decision,
        options_json: input.options_json,
        recommended_option: input.recommended_option,
        paused_stage: input.paused_stage,
        paused_at: nowIso(),
        decision_ttl_at: input.decision_ttl_at,
        status: "waiting",
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      repos.handoffs.save(handoff);
      repos.audit.append({
        audit_id: `audit_${randomUUID()}`,
        handoff_id: handoff.handoff_id,
        mission_id: input.mission_id,
        event_type: "handoff_created",
        payload: { handoff_type: input.handoff_type, reason_code: input.reason_code },
        timestamp: nowIso(),
      });
      return handoff;
    },

    recordHumanDecision(input: {
      handoff_id: string;
      mission_id: string;
      actor_id: string;
      decision: HumanDecisionType;
      selected_option?: string;
      input_payload_json?: string;
      note?: string;
    }): HumanDecision {
      const handoff = repos.handoffs.getById(input.handoff_id);
      if (!handoff) throw new Error("Handoff not found");
      if (handoff.status !== "waiting" && handoff.status !== "open") {
        throw new Error(`Handoff status is ${handoff.status}, cannot record decision`);
      }

      const decision: HumanDecision = {
        decision_id: `decision_${randomUUID()}`,
        handoff_id: input.handoff_id,
        mission_id: input.mission_id,
        actor_id: input.actor_id,
        decision: input.decision,
        selected_option: input.selected_option,
        input_payload_json: input.input_payload_json,
        note: input.note,
        decided_at: nowIso(),
      };
      repos.decisions.save(decision);
      repos.handoffs.save({ ...handoff, status: "answered", updated_at: nowIso() });
      repos.audit.append({
        audit_id: `audit_${randomUUID()}`,
        handoff_id: input.handoff_id,
        mission_id: input.mission_id,
        event_type: "decision_recorded",
        payload: { decision: input.decision, actor_id: input.actor_id },
        timestamp: nowIso(),
      });
      return decision;
    },

    resumeFromDecision(input: {
      handoff_id: string;
      mission_id: string;
    }): ResumeContract {
      const handoff = repos.handoffs.getById(input.handoff_id);
      if (!handoff) throw new Error("Handoff not found");
      if (handoff.status !== "answered") {
        throw new Error(`Handoff status is ${handoff.status}, cannot resume`);
      }

      const decision = repos.decisions.getByHandoffId(input.handoff_id);
      if (!decision) throw new Error("No decision found for handoff");

      let resumeMode: ResumeMode = "continue_same_run";
      let resultStatus: ResumeContract["result_status"] = "resumed";
      let reason: string | undefined;

      switch (decision.decision) {
        case "approved":
          resumeMode = "continue_same_run";
          resultStatus = "resumed";
          reason = "Approved by human";
          break;
        case "rejected":
          resumeMode = "cancel_after_rejection";
          resultStatus = "cancelled";
          reason = "Rejected by human";
          break;
        case "option_selected":
          resumeMode = "continue_new_run";
          resultStatus = "resumed";
          reason = `Option selected: ${decision.selected_option}`;
          break;
        case "input_provided":
          resumeMode = "continue_new_run";
          resultStatus = "resumed";
          reason = "Input provided by human";
          break;
        case "manual_execution_confirmed":
          resumeMode = "manual_close";
          resultStatus = "resumed";
          reason = "Manual execution confirmed";
          break;
        case "mission_cancelled":
          resumeMode = "manual_close";
          resultStatus = "cancelled";
          reason = "Mission cancelled by human";
          break;
        default:
          resumeMode = "continue_same_run";
          resultStatus = "resumed";
          reason = "Unknown decision";
      }

      const resume: ResumeContract = {
        resume_id: `resume_${randomUUID()}`,
        handoff_id: input.handoff_id,
        mission_id: input.mission_id,
        run_id: handoff.run_id,
        resume_mode: resumeMode,
        resume_payload_json: decision.input_payload_json,
        resumed_by: "human_decision",
        resumed_at: nowIso(),
        result_status: resultStatus,
        reason,
      };
      repos.resume.save(resume);
      repos.handoffs.save({ ...handoff, status: "resolved", updated_at: nowIso() });
      repos.audit.append({
        audit_id: `audit_${randomUUID()}`,
        handoff_id: input.handoff_id,
        mission_id: input.mission_id,
        event_type: "resume_completed",
        payload: { resume_mode: resumeMode, result_status: resultStatus },
        timestamp: nowIso(),
      });
      return resume;
    },

    expireHandoff(handoff_id: string, reason: string): void {
      const handoff = repos.handoffs.getById(handoff_id);
      if (!handoff) throw new Error("Handoff not found");
      if (handoff.status !== "waiting") return;
      repos.handoffs.save({ ...handoff, status: "expired", updated_at: nowIso() });
      repos.audit.append({
        audit_id: `audit_${randomUUID()}`,
        handoff_id,
        mission_id: handoff.mission_id,
        event_type: "handoff_expired",
        payload: { reason },
        timestamp: nowIso(),
      });
    },

    cancelHandoff(handoff_id: string, reason: string): void {
      const handoff = repos.handoffs.getById(handoff_id);
      if (!handoff) throw new Error("Handoff not found");
      if (handoff.status === "resolved" || handoff.status === "cancelled") return;
      repos.handoffs.save({ ...handoff, status: "cancelled", updated_at: nowIso() });
      repos.audit.append({
        audit_id: `audit_${randomUUID()}`,
        handoff_id,
        mission_id: handoff.mission_id,
        event_type: "handoff_cancelled",
        payload: { reason },
        timestamp: nowIso(),
      });
    },

    getHandoffAuditTrail(mission_id: string): HitlAuditEvent[] {
      return repos.audit.getTrail(mission_id);
    },

    getOpenHandoffs(): HandoffPacket[] {
      return repos.handoffs.getOpenHandoffs();
    },
  };
}

export type HitlApi = ReturnType<typeof createHitlApi>;
