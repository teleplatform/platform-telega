import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord } from "./execution-evidence-store.js";
import { hashTraceId } from "./execution-hash.js";

export interface ExecutionPolicy {
  allow: {
    task_kinds: string[];
    targets: string[];
    requested_by: string[];
  };
  require_approval: {
    target_override: boolean;
    force_replay: boolean;
    system_requested: boolean;
    high_risk_task_kinds: string[];
    shell_commands: boolean;
    remote_write: boolean;
  };
  block: {
    unknown_target: boolean;
    unknown_task_kind: boolean;
  };
}

export type ExecutionPolicyDecision = "allowed" | "blocked" | "requires_approval";

export interface ExecutionPolicyInput {
  task_kind: string;
  target?: string;
  requested_by: "manual" | "system" | "mission_control";
  has_shell_commands?: boolean;
  has_remote_write?: boolean;
  is_replay?: boolean;
  force?: boolean;
  target_override?: boolean;
}

export interface ExecutionPolicyResult {
  decision: ExecutionPolicyDecision;
  reason: string;
}

const POLICY_PATH = path.join(process.cwd(), ".sigma", "policies", "execution-policy.json");

const DEFAULT_POLICY: ExecutionPolicy = {
  allow: {
    task_kinds: ["code", "code_change", "ui", "analysis", "agent", "generic", "sales_followup", "support_ticket", "kb_update"],
    targets: ["kilo_mcp", "forge_remote", "local_ollama"],
    requested_by: ["manual", "system", "mission_control"],
  },
  require_approval: {
    target_override: true,
    force_replay: true,
    system_requested: false,
    high_risk_task_kinds: ["agent"],
    shell_commands: true,
    remote_write: true,
  },
  block: {
    unknown_target: true,
    unknown_task_kind: true,
  },
};

let cachedPolicy: ExecutionPolicy | null = null;

export function loadExecutionPolicy(): ExecutionPolicy {
  if (cachedPolicy) return cachedPolicy;

  if (!fs.existsSync(POLICY_PATH)) {
    cachedPolicy = { ...DEFAULT_POLICY };
    deepCloneDefaults(cachedPolicy);
    appendEvidenceRecord({
      evidence_id: hashTraceId("exec-policy", "execution_policy_missing_default_used"),
      trace_id: "exec-policy",
      job_id: "exec-policy",
      type: "execution_policy_missing_default_used",
      timestamp: new Date().toISOString(),
      payload: { path: POLICY_PATH },
    }).catch(() => {});
    return cachedPolicy!;
  }

  try {
    const content = fs.readFileSync(POLICY_PATH, { encoding: "utf8" });
    const parsed = JSON.parse(content) as ExecutionPolicy;
    cachedPolicy = parsed;
    appendEvidenceRecord({
      evidence_id: hashTraceId("exec-policy", "execution_policy_loaded"),
      trace_id: "exec-policy",
      job_id: "exec-policy",
      type: "execution_policy_loaded",
      timestamp: new Date().toISOString(),
      payload: {
        allow: parsed.allow,
        require_approval: parsed.require_approval,
        block: parsed.block,
      },
    }).catch(() => {});
    return parsed;
  } catch {
    cachedPolicy = { ...DEFAULT_POLICY };
    deepCloneDefaults(cachedPolicy);
    return cachedPolicy;
  }
}

function deepCloneDefaults(policy: ExecutionPolicy): void {
  policy.allow = { ...DEFAULT_POLICY.allow, task_kinds: [...DEFAULT_POLICY.allow.task_kinds], targets: [...DEFAULT_POLICY.allow.targets], requested_by: [...DEFAULT_POLICY.allow.requested_by] };
  policy.require_approval = { ...DEFAULT_POLICY.require_approval, high_risk_task_kinds: [...DEFAULT_POLICY.require_approval.high_risk_task_kinds] };
  policy.block = { ...DEFAULT_POLICY.block };
}

export function getExecutionPolicyHash(): string {
  const policy = loadExecutionPolicy();
  return hashTraceId(JSON.stringify(policy), "exec_policy_hash").slice(0, 16);
}

export function clearExecutionPolicyCache(): void {
  cachedPolicy = null;
}

export function evaluateExecutionPolicy(input: ExecutionPolicyInput): ExecutionPolicyResult {
  const policy = loadExecutionPolicy();

  const taskKind = input.task_kind || "generic";
  const target = input.target;
  const requestedBy = input.requested_by || "manual";

  if (policy.block.unknown_task_kind && !policy.allow.task_kinds.includes(taskKind)) {
    return { decision: "blocked", reason: `task_kind not allowed: ${taskKind}` };
  }

  if (target && policy.block.unknown_target && !policy.allow.targets.includes(target)) {
    return { decision: "blocked", reason: `target not allowed: ${target}` };
  }

  if (!policy.allow.requested_by.includes(requestedBy)) {
    return { decision: "blocked", reason: `requested_by not allowed: ${requestedBy}` };
  }

  const approvalReasons: string[] = [];

  if (input.target_override && policy.require_approval.target_override) {
    approvalReasons.push("target_override");
  }

  if (input.is_replay && input.force && policy.require_approval.force_replay) {
    approvalReasons.push("force_replay");
  }

  if (requestedBy === "system" && policy.require_approval.system_requested) {
    approvalReasons.push("system_requested");
  }

  if (policy.require_approval.high_risk_task_kinds.includes(taskKind)) {
    approvalReasons.push(`high_risk_task_kind:${taskKind}`);
  }

  if (input.has_shell_commands && policy.require_approval.shell_commands) {
    approvalReasons.push("shell_commands");
  }

  if (input.has_remote_write && policy.require_approval.remote_write) {
    approvalReasons.push("remote_write");
  }

  if (approvalReasons.length > 0) {
    return { decision: "requires_approval", reason: `requires_approval: ${approvalReasons.join(", ")}` };
  }

  return { decision: "allowed", reason: "allowed: execution policy passed" };
}

export async function writeExecutionPolicyEvidence(
  traceId: string,
  jobId: string,
  result: ExecutionPolicyResult,
): Promise<void> {
  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, result.decision === "blocked" ? "execution_policy_blocked" : "execution_policy_checked"),
    trace_id: traceId,
    job_id: jobId,
    type: result.decision === "blocked" ? "execution_policy_blocked" : "execution_policy_checked",
    timestamp: new Date().toISOString(),
    payload: {
      decision: result.decision,
      reason: result.reason,
    },
  });
}
