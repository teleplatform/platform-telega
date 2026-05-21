import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { checkConstitution } from "../constitution/runtime-constitution.js";
import { enforceDoctrines } from "../knowledge/doctrine-enforcement-layer.js";
import { checkCostGovernance } from "../economy/runtime-cost-governance.js";
import { createExecutionApprovalRequest } from "../policy/execution-approval-queue.js";
import { checkRuntimeDecisionPoint } from "./runtime-decision-point-registry.js";
import { checkRuntimeMode } from "./runtime-mode-enforcement-hook.js";

export type FileOperationKind =
  | "read"
  | "write"
  | "append"
  | "overwrite"
  | "delete"
  | "move"
  | "copy"
  | "chmod"
  | "chown"
  | "mkdir"
  | "rmdir"
  | "export";

export interface FileOperationGovernanceInput {
  kind: FileOperationKind;
  path: string;
  target_path?: string;
  bytes_estimate?: number;
  requested_by?: "manual" | "system" | "mission_control" | "agent";
  actor_id?: string;
  trace_id?: string;
  task_id?: string;
  risk_hint?: "low" | "medium" | "high" | "critical";
}

export interface FileOperationGovernanceResult {
  decision: "allowed" | "blocked" | "requires_approval";
  reason: string;
  risk_level: "low" | "medium" | "high" | "critical";
  checks: {
    constitution: "passed" | "blocked";
    doctrine: "passed" | "blocked";
    policy: "passed" | "blocked" | "requires_approval";
    budget: "passed" | "warning" | "blocked";
  };
  approval_id?: string;
}

const PROJECT_ROOT = process.cwd();

interface FileRiskRule {
  pattern: (path: string) => boolean;
  risk: "low" | "medium" | "high" | "critical";
  kind?: FileOperationKind;
}

function isOutsideProjectRoot(filePath: string): boolean {
  const resolved = filePath.startsWith("/") ? filePath : require("path").resolve(PROJECT_ROOT, filePath);
  return !resolved.startsWith(PROJECT_ROOT);
}

function isInDotSigma(filePath: string): boolean {
  return filePath.includes("/.sigma/") || filePath.includes("\\.sigma\\");
}

function isInDotData(filePath: string): boolean {
  return filePath.includes("/.data/") || filePath.includes("\\.data\\");
}

function isInDotGit(filePath: string): boolean {
  return filePath.includes("/.git/") || filePath.includes("\\.git\\");
}

function isSecretsFile(filePath: string): boolean {
  const basename = filePath.split("/").pop() || filePath.split("\\").pop() || "";
  const secrets = [".env", ".env.local", ".env.production", ".pem", ".key", "id_rsa", "credentials", "secrets"];
  return secrets.some((s) => basename.includes(s) || filePath.endsWith(s));
}

function isConfigFile(filePath: string): boolean {
  const configs = ["package.json", "tsconfig.json", "tsconfig.server.json", "next.config", ".eslintrc", "prettier.config"];
  return configs.some((c) => filePath.includes(c));
}

function isEvidenceFile(filePath: string): boolean {
  return filePath.includes("evidence.jsonl") || filePath.includes("execution-evidence");
}

function isFreezeFile(filePath: string): boolean {
  return filePath.includes("-freeze.json") || filePath.includes("baseline.json");
}

const RISK_RULES: FileRiskRule[] = [
  { pattern: (p) => isOutsideProjectRoot(p), risk: "critical" },
  { pattern: (p) => isSecretsFile(p), risk: "critical" },
  { pattern: (p) => isInDotGit(p), risk: "critical" },
  { pattern: (p) => isInDotSigma(p), risk: "high" },
  { pattern: (p) => isFreezeFile(p), risk: "high", kind: "overwrite" },
  { pattern: (p) => isEvidenceFile(p), risk: "high", kind: "overwrite" },
  { pattern: (p) => isEvidenceFile(p), risk: "critical", kind: "delete" },
  { pattern: (p) => isConfigFile(p), risk: "high", kind: "overwrite" },
  { pattern: (p) => true, risk: "low" },
];

function computeRisk(input: FileOperationGovernanceInput): { risk: "low" | "medium" | "high" | "critical"; reason: string } {
  for (const rule of RISK_RULES) {
    if (rule.kind && rule.kind !== input.kind) continue;
    if (rule.pattern(input.path)) {
      return { risk: rule.risk, reason: `${input.kind} on ${pathShort(input.path)}` };
    }
  }
  return { risk: input.risk_hint || "low", reason: `${input.kind} on ${pathShort(input.path)}` };
}

function pathShort(p: string): string {
  if (p.startsWith(PROJECT_ROOT)) return p.slice(PROJECT_ROOT.length + 1);
  return p;
}

function computePolicy(input: FileOperationGovernanceInput, risk: string): "passed" | "blocked" | "requires_approval" {
  if (risk === "critical") {
    if (isOutsideProjectRoot(input.path)) return "blocked";
    if (isSecretsFile(input.path)) return "blocked";
    if (isInDotGit(input.path) && input.kind !== "read") return "blocked";
    if (isEvidenceFile(input.path) && input.kind === "delete") return "blocked";
    return "requires_approval";
  }
  if (risk === "high") {
    if (input.kind === "delete" || input.kind === "rmdir") return "requires_approval";
    if (input.kind === "overwrite") return "requires_approval";
    if (input.kind === "chmod" || input.kind === "chown") return "requires_approval";
    return "requires_approval";
  }
  if (risk === "medium") {
    if (input.kind === "delete" || input.kind === "overwrite") return "requires_approval";
    return "passed";
  }
  if (input.kind === "read" || input.kind === "append" || input.kind === "mkdir") return "passed";
  if (input.kind === "write") return "passed";
  return "passed";
}

let hookCounter = 0;

export async function checkFileOperationGovernance(
  input: FileOperationGovernanceInput,
): Promise<FileOperationGovernanceResult> {
  hookCounter++;
  const traceId = input.trace_id || hashTraceId(`file_gov_${hookCounter}`, "file_governance_checked");
  const actor = input.actor_id || input.requested_by || "system";
  await checkRuntimeDecisionPoint({ kind: "file_operation", trace_id: traceId, actor_id: actor, context: { kind: input.kind } });

  const { risk, reason: riskReason } = computeRisk(input);
  const riskLevel = risk;
  const modeCheck = await checkRuntimeMode({
    mode: input.requested_by === "manual" ? "creator" : "public",
    action: "file",
    risk: riskLevel,
    destructive: ["delete", "rmdir", "overwrite", "chmod", "chown"].includes(input.kind),
    trace_id: traceId,
    actor_id: actor,
  });

  const constitutionCheck = checkConstitution(`file_${input.kind}`, actor);
  const constitution: "passed" | "blocked" = constitutionCheck.allowed ? "passed" : "blocked";

  let doctrineBlocked = false;
  if (riskLevel === "high" || riskLevel === "critical") {
    const dr = await enforceDoctrines("dangerous_execution");
    doctrineBlocked = dr.blocked;
  }
  const doctrine: "passed" | "blocked" = doctrineBlocked ? "blocked" : "passed";

  const policyResult = computePolicy(input, riskLevel);

  const cost = riskLevel === "critical" ? 10 : riskLevel === "high" ? 5 : riskLevel === "medium" ? 2 : 0;
  let budget: "passed" | "warning" | "blocked" = "passed";
  if (cost > 0) {
    const budgetCheck = await checkCostGovernance("storage", cost);
    budget = budgetCheck.approved ? "passed" : "blocked";
  }

  let decision: "allowed" | "blocked" | "requires_approval";
  let reason: string;
  let approval_id: string | undefined;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "file_governance_checked"),
    trace_id: traceId,
    job_id: "hooks",
    type: "file_governance_checked",
    timestamp: new Date().toISOString(),
    payload: { kind: input.kind, path: pathShort(input.path), risk_level: riskLevel, policy: policyResult },
  });

  if (modeCheck.decision === "blocked") {
    decision = "blocked";
    reason = modeCheck.reason;
  } else if (constitution === "blocked") {
    decision = "blocked";
    reason = `Constitutional violation: ${constitutionCheck.violations.map((v) => v.rule_id).join(", ")}`;
  } else if (doctrine === "blocked") {
    decision = "blocked";
    reason = "Doctrine enforcement blocked file operation";
  } else if (budget === "blocked") {
    decision = "blocked";
    reason = "Budget check failed for file operation";
  } else if (policyResult === "blocked") {
    decision = "blocked";
    reason = `Policy blocked: ${riskReason}`;
  } else if (policyResult === "requires_approval") {
    const approval = await createExecutionApprovalRequest({
      job_id: input.task_id,
      trace_id: traceId,
      task_kind: `file_${input.kind}`,
      target: pathShort(input.path),
      requested_by: mapRequester(input.requested_by),
      reason: `File ${input.kind} risk ${riskLevel}: ${pathShort(input.path)}`,
    });
    approval_id = approval.approval_id;
    decision = "requires_approval";
    reason = `Approval required (risk: ${riskLevel}). Approval ID: ${approval_id}`;
  } else {
    decision = "allowed";
    reason = "All checks passed";
  }

  const evidenceType = decision === "allowed" ? "file_governance_allowed"
    : decision === "blocked" ? "file_governance_blocked"
    : "file_governance_approval_required";

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, evidenceType),
    trace_id: traceId,
    job_id: "hooks",
    type: evidenceType,
    timestamp: new Date().toISOString(),
    payload: {
      kind: input.kind,
      path: pathShort(input.path),
      risk_level: riskLevel,
      decision,
      constitution: constitutionCheck.allowed,
      doctrine_blocked: doctrineBlocked,
      policy: policyResult,
      budget_approved: budget === "passed",
      approval_id,
      requested_by: actor,
    },
  });

  return {
    decision,
    reason,
    risk_level: riskLevel,
    checks: { constitution, doctrine, policy: policyResult, budget },
    approval_id,
  };
}

function mapRequester(r?: "manual" | "system" | "mission_control" | "agent"): "manual" | "system" | "mission_control" {
  if (r === "agent") return "system";
  return r || "system";
}
