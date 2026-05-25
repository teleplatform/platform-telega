import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getIncident } from "./runtime-incident-command.js";
import type { IncidentSeverity } from "./incident-severity-matrix.js";
import {
  loadTelegramSenderConfig,
  sendTelegramMissionControlMessage,
} from "../mission-control/telegram-sender.js";
import { renderAndEmitIncidentTelegramKeyboard } from "../mission-control/telegram-inline-keyboard.js";

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

  const senderConfig = loadTelegramSenderConfig();
  if (senderConfig.enabled || senderConfig.dry_run) {
    const chatId = senderConfig.default_chat_id || "0";
    const telegramMessage = await renderAndEmitIncidentTelegramKeyboard(approval, chatId);
    await sendTelegramMissionControlMessage(telegramMessage, {
      ...senderConfig,
      enabled: senderConfig.enabled || !!senderConfig.dry_run,
      dry_run: senderConfig.dry_run !== false,
    });
  }

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

export async function restoreIncidentApprovalsFromEvidence(): Promise<IncidentApproval[]> {
  const restored = new Map<string, IncidentApproval>();

  for (const record of readEvidenceRecords({ order: "asc" })) {
    if (record.type === "incident_approval_required") {
      const approvalId = String(record.payload?.approval_id || record.trace_id);
      restored.set(approvalId, {
        approval_id: approvalId,
        incident_id: String(record.payload?.incident_id || ""),
        action: String(record.payload?.action || "unknown"),
        requested_at: record.timestamp,
        status: "pending",
      });
    }

    if (record.type === "incident_approval_granted" || record.type === "incident_approval_denied") {
      const approvalId = String(record.payload?.approval_id || record.trace_id);
      const approval = restored.get(approvalId);
      if (!approval) continue;
      approval.status = record.type === "incident_approval_granted" ? "granted" : "denied";
      approval.granted_at = record.type === "incident_approval_granted" ? record.timestamp : approval.granted_at;
      approval.granted_by = record.payload?.granted_by ? String(record.payload.granted_by) : approval.granted_by;
      approval.reason = record.payload?.reason ? String(record.payload.reason) : approval.reason;
      restored.set(approvalId, approval);
    }
  }

  for (const approval of restored.values()) {
    APPROVALS.set(approval.approval_id, approval);
  }

  return Array.from(restored.values());
}
