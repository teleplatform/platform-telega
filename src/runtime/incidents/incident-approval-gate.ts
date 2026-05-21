import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getIncident } from "./runtime-incident-command.js";
import type { IncidentSeverity } from "./incident-severity-matrix.js";

export interface IncidentApproval {
  approval_id: string;
  incident_id: string;
  action: string;
  requested_at: string;
  status: "pending" | "granted" | "denied";
  granted_at?: string;
  granted_by?: string;
  reason?: string;
}

const APPROVALS: Map<string, IncidentApproval> = new Map();
let approvalCounter = 0;

export function requiresApproval(severity: IncidentSeverity): boolean {
  return severity === "high" || severity === "critical" || severity === "civilization_risk";
}

export async function requestIncidentApproval(
  incidentId: string,
  action: string,
): Promise<IncidentApproval> {
  approvalCounter++;
  const approval: IncidentApproval = {
    approval_id: `inc_app_${Date.now()}_${approvalCounter}`,
    incident_id: incidentId,
    action,
    requested_at: new Date().toISOString(),
    status: "pending",
  };

  APPROVALS.set(approval.approval_id, approval);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(approval.approval_id, "incident_approval_required"),
    trace_id: approval.approval_id,
    job_id: "incidents",
    type: "incident_approval_required",
    timestamp: approval.requested_at,
    payload: {
      approval_id: approval.approval_id,
      incident_id: incidentId,
      action,
      severity: getIncident(incidentId)?.severity,
    },
  });

  return approval;
}

export async function grantIncidentApproval(
  approvalId: string,
  grantedBy: string,
  reason?: string,
): Promise<IncidentApproval | null> {
  const approval = APPROVALS.get(approvalId);
  if (!approval) return null;

  approval.status = "granted";
  approval.granted_at = new Date().toISOString();
  approval.granted_by = grantedBy;
  approval.reason = reason;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(approvalId, "incident_approval_granted"),
    trace_id: approvalId,
    job_id: "incidents",
    type: "incident_approval_granted",
    timestamp: approval.granted_at,
    payload: {
      approval_id: approvalId,
      incident_id: approval.incident_id,
      action: approval.action,
      granted_by: grantedBy,
    },
  });

  return approval;
}

export async function denyIncidentApproval(
  approvalId: string,
  reason: string,
): Promise<IncidentApproval | null> {
  const approval = APPROVALS.get(approvalId);
  if (!approval) return null;

  approval.status = "denied";
  approval.reason = reason;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(approvalId, "incident_approval_denied"),
    trace_id: approvalId,
    job_id: "incidents",
    type: "incident_approval_denied",
    timestamp: new Date().toISOString(),
    payload: {
      approval_id: approvalId,
      incident_id: approval.incident_id,
      action: approval.action,
      reason,
    },
  });

  return approval;
}

export function getApproval(approvalId: string): IncidentApproval | null {
  return APPROVALS.get(approvalId) || null;
}

export function getPendingApprovals(): IncidentApproval[] {
  return Array.from(APPROVALS.values()).filter((a) => a.status === "pending");
}
