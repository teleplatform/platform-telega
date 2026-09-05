import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { RuntimeAccessMode } from "../provider/provider.types.js";
import type { RuntimeInput } from "../input/runtime-input.types.js";

export interface ModePolicyCheckResult {
  mode: RuntimeAccessMode;
  action_allowed: boolean;
  reason: string;
}

export class RuntimeModePolicy {
  checkAction(mode: RuntimeAccessMode, actionType: string, input: RuntimeInput): ModePolicyCheckResult {
    if (actionType === "creator_web_access" && mode !== "creator") {
      const result: ModePolicyCheckResult = {
        mode,
        action_allowed: false,
        reason: `Creator web access is only allowed in creator mode (current: ${mode})`,
      };

      appendEvidenceRecord({
        evidence_id: hashTraceId(input.input_id, "runtime_mode_policy_checked"),
        trace_id: input.input_id,
        job_id: "mode",
        type: "runtime_mode_policy_checked" as any,
        timestamp: new Date().toISOString(),
        payload: {
          mode,
          action_type: actionType,
          allowed: false,
          reason: result.reason,
        },
      });

      return result;
    }

    appendEvidenceRecord({
      evidence_id: hashTraceId(input.input_id, "runtime_mode_policy_checked"),
      trace_id: input.input_id,
      job_id: "mode",
      type: "runtime_mode_policy_checked" as any,
      timestamp: new Date().toISOString(),
      payload: {
        mode,
        action_type: actionType,
        allowed: true,
      },
    });

    return {
      mode,
      action_allowed: true,
      reason: `Action ${actionType} allowed in ${mode} mode`,
    };
  }

  canAccessCreatorWeb(mode: RuntimeAccessMode): boolean {
    return mode === "creator";
  }

  canAccessApiModel(mode: RuntimeAccessMode): boolean {
    return true; // API models available in all modes
  }

  canAccessLocalModel(mode: RuntimeAccessMode): boolean {
    return true; // Local models available in all modes
  }
}
