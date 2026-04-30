import type { ComplianceDecision, RedactionEntry, SensitivityLevel } from "../../runtime-safety-contracts/src/compliance.js";
import { detectSensitive } from "./detectSensitive.js";
import { classifySensitivity } from "./classifySensitivity.js";
import { redactObject, redactText } from "./redactPayload.js";
import { resolveOutboundPolicy } from "./outboundPolicy.js";

export interface ComplianceContext {
  target?: "provider" | "tool" | "channel" | "storage";
  tele_user_id?: string;
  task_id?: string;
  session_id?: string;
}

export interface ComplianceAuditEntry {
  audit_id: string;
  task_id?: string;
  session_id?: string;
  tele_user_id?: string;
  sensitivity: SensitivityLevel;
  allowed: boolean;
  blocked_reasons: string[];
  redactions: RedactionEntry[];
  outbound_policy: ComplianceDecision["outbound_policy"];
  created_at: string;
}

export function runComplianceGateway(payload: unknown, context?: ComplianceContext): { decision: ComplianceDecision; sanitized_payload?: unknown; audit: ComplianceAuditEntry } {
  const detections = typeof payload === "string" ? detectSensitive(payload) : typeof payload === "object" && payload !== null ? detectSensitive(payload as Record<string, unknown>) : [];

  const sensitivity = classifySensitivity(payload, detections);
  const outboundPolicy = resolveOutboundPolicy(sensitivity, { target: context?.target ?? "provider" });

  const blocked_reasons: string[] = [];
  if (sensitivity === "regulated" && context?.target === "provider") {
    blocked_reasons.push("regulated_data_cannot_go_to_external_provider");
  }
  if (sensitivity === "confidential" && context?.target === "provider") {
    blocked_reasons.push("confidential_data_requires_local_processing");
  }

  const allowed = blocked_reasons.length === 0;

  let sanitized_payload: unknown = payload;
  if (detections.length > 0) {
    if (typeof payload === "string") {
      sanitized_payload = redactText(payload, detections);
    } else if (typeof payload === "object" && payload !== null) {
      sanitized_payload = redactObject(payload as Record<string, unknown>, detections);
    }
  }

  const decision: ComplianceDecision = {
    allowed,
    sensitivity,
    redactions: detections,
    blocked_reasons,
    outbound_policy: outboundPolicy,
  };

  const audit: ComplianceAuditEntry = {
    audit_id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    task_id: context?.task_id,
    session_id: context?.session_id,
    tele_user_id: context?.tele_user_id,
    sensitivity,
    allowed,
    blocked_reasons,
    redactions: detections,
    outbound_policy: outboundPolicy,
    created_at: new Date().toISOString(),
  };

  return { decision, sanitized_payload, audit };
}
