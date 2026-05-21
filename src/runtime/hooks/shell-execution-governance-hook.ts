import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { checkConstitution } from "../constitution/runtime-constitution.js";
import { enforceDoctrines } from "../knowledge/doctrine-enforcement-layer.js";
import { createExecutionApprovalRequest } from "../policy/execution-approval-queue.js";
import { consumeRuntimeBudget } from "./runtime-budget-middleware.js";
import { maybeEscalateRuntimeIncident } from "./runtime-incident-auto-escalation-hook.js";
import { checkRuntimeDecisionPoint } from "./runtime-decision-point-registry.js";
import { checkRuntimeMode } from "./runtime-mode-enforcement-hook.js";

export interface ShellExecutionGovernanceInput {
  command: string;
  cwd?: string;
  requested_by?: "manual" | "system" | "mission_control" | "agent";
  actor_id?: string;
  trace_id?: string;
  task_id?: string;
  risk_hint?: "low" | "medium" | "high" | "critical";
}

export interface ShellExecutionGovernanceResult {
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

const DANGEROUS_SHELL_PATTERNS: Array<{ pattern: RegExp; risk: "high" | "critical" }> = [
  { pattern: /\brm\s+-rf\b/, risk: "critical" },
  { pattern: /\bsudo\b/, risk: "high" },
  { pattern: /chmod\s+777/, risk: "high" },
  { pattern: /\bchown\b/, risk: "high" },
  { pattern: /curl\s+.*\|\s*(?:bash|sh|zsh)/, risk: "critical" },
  { pattern: /wget\s+.*\|\s*(?:bash|sh|zsh)/, risk: "critical" },
  { pattern: /\bdd\s+/, risk: "critical" },
  { pattern: /\bmkfs\b/, risk: "critical" },
  { pattern: /diskutil\s+erase/, risk: "critical" },
  { pattern: /\bkillall\b/, risk: "high" },
  { pattern: /\bpkill\b/, risk: "high" },
  { pattern: /git\s+reset\s+--hard/, risk: "high" },
  { pattern: /git\s+clean\s+-fd/, risk: "high" },
  { pattern: /npm\s+publish/, risk: "high" },
  { pattern: /vercel\s+--prod/, risk: "high" },
  { pattern: /docker\s+system\s+prune/, risk: "critical" },
  { pattern: /docker\s+rm\s+/, risk: "high" },
  { pattern: />\s*\/dev\/(?:sda|sdb|sdc|nvme)/, risk: "critical" },
  { pattern: /:\(\)\s*\{/, risk: "critical" },
  { pattern: /\beval\b/, risk: "high" },
  { pattern: /\bexec\b/, risk: "high" },
  { pattern: /\bsource\s+\/dev\//, risk: "critical" },
  { pattern: /shutdown\s+/, risk: "critical" },
  { pattern: /reboot\b/, risk: "critical" },
  { pattern: /launchctl\s+unload/, risk: "high" },
  { pattern: /launchctl\s+bootout/, risk: "high" },
];

const KNOWN_SAFE_PREFIXES = [
  "ls", "pwd", "which", "head", "tail", "wc", "sort", "uniq",
  "echo", "cat ", "grep", "find ", "git status", "git diff",
  "git log", "git show", "git branch",
  "npx tsx", "pnpm", "npm", "node ",
  "python3", "ffmpeg", "ffprobe",
];

function computeBudgetCost(risk: string): number {
  switch (risk) {
    case "low": return 1;
    case "medium": return 3;
    case "high": return 10;
    case "critical": return 25;
    default: return 1;
  }
}

function classifyRisk(command: string): { risk: "low" | "medium" | "high" | "critical"; dangerous: boolean } {
  for (const entry of DANGEROUS_SHELL_PATTERNS) {
    if (entry.pattern.test(command)) {
      return { risk: entry.risk, dangerous: true };
    }
  }
  const isKnownSafe = KNOWN_SAFE_PREFIXES.some((p) => command.trim().startsWith(p));
  if (isKnownSafe) {
    return { risk: "low", dangerous: false };
  }
  if (command.length > 200) {
    return { risk: "medium", dangerous: true };
  }
  return { risk: "medium", dangerous: false };
}

function checkPolicy(command: string, risk: string): "passed" | "blocked" | "requires_approval" {
  if (risk === "critical") return "requires_approval";
  if (risk === "high") return "requires_approval";
  if (command.includes("|") && risk !== "low") return "requires_approval";
  return "passed";
}

let hookCounter = 0;

export async function checkShellExecutionGovernance(
  input: ShellExecutionGovernanceInput,
): Promise<ShellExecutionGovernanceResult> {
  hookCounter++;
  const traceId = input.trace_id || hashTraceId(`shell_gov_${hookCounter}`, "shell_governance_checked");
  const actor = input.actor_id || input.requested_by || "system";
  await checkRuntimeDecisionPoint({ kind: "shell_execution", trace_id: traceId, actor_id: actor });

  const { risk, dangerous } = classifyRisk(input.command);
  const riskLevel = input.risk_hint && !dangerous ? input.risk_hint : risk;
  const modeCheck = await checkRuntimeMode({
    mode: input.requested_by === "manual" ? "creator" : "public",
    action: "shell",
    risk: riskLevel,
    trace_id: traceId,
    actor_id: actor,
  });

  const constitutionCheck = checkConstitution("shell_exec", actor);
  const constitution: "passed" | "blocked" = constitutionCheck.allowed ? "passed" : "blocked";

  let doctrineResult: { blocked: boolean } = { blocked: false };
  if (dangerous || riskLevel !== "low") {
    doctrineResult = await enforceDoctrines("dangerous_execution");
  }
  const doctrine: "passed" | "blocked" = doctrineResult.blocked ? "blocked" : "passed";

  const policyResult = checkPolicy(input.command, riskLevel);

  const cost = computeBudgetCost(riskLevel);
  const budgetCheck = await consumeRuntimeBudget({
    action: "shell_action",
    units: Math.max(1, Math.ceil(cost / 3)),
    trace_id: traceId,
    task_id: input.task_id,
    actor_id: actor,
    mode: input.requested_by === "manual" ? "creator" : "public",
  });
  const budget: "passed" | "warning" | "blocked" = budgetCheck.allowed ? "passed" : "blocked";

  let decision: "allowed" | "blocked" | "requires_approval";
  let reason: string;
  let approval_id: string | undefined;

  if (modeCheck.decision === "blocked") {
    decision = "blocked";
    reason = modeCheck.reason;
  } else if (constitution === "blocked") {
    decision = "blocked";
    reason = `Constitutional violation: ${constitutionCheck.violations.map((v) => v.rule_id).join(", ")}`;
  } else if (doctrine === "blocked") {
    decision = "blocked";
    reason = "Doctrine enforcement blocked shell execution";
  } else if (budget === "blocked") {
    decision = "blocked";
    reason = `Budget check failed: ${budgetCheck.reason || "insufficient budget"}`;
  } else if (policyResult === "requires_approval") {
    const approval = await createExecutionApprovalRequest({
      job_id: input.task_id,
      trace_id: traceId,
      task_kind: "shell_execution",
      target: input.command.slice(0, 200),
      requested_by: mapRequester(input.requested_by),
      reason: `Shell command risk level: ${riskLevel}. Command: ${input.command.slice(0, 200)}`,
    });
    approval_id = approval.approval_id;
    decision = "requires_approval";
    reason = `Approval required (risk: ${riskLevel}). Approval ID: ${approval_id}`;
  } else {
    decision = "allowed";
    reason = "All checks passed";
  }

  const evidenceType = decision === "allowed" ? "shell_governance_allowed"
    : decision === "blocked" ? "shell_governance_blocked"
    : "shell_governance_approval_required";

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, evidenceType),
    trace_id: traceId,
    job_id: "hooks",
    type: evidenceType,
    timestamp: new Date().toISOString(),
    payload: {
      command: input.command.slice(0, 500),
      risk_level: riskLevel,
      decision,
      constitution: constitutionCheck.allowed,
      doctrine_blocked: doctrineResult.blocked,
      policy: policyResult,
      budget_approved: budgetCheck.allowed,
      approval_id,
      requested_by: actor,
    },
  });

  if (decision === "blocked") {
    await maybeEscalateRuntimeIncident({
      kind: budget === "blocked" ? "budget_exhausted" : "governance_blocked",
      title: "Shell governance blocked runtime action",
      description: reason,
      trace_id: traceId,
      affected: ["shell_execution"],
      severity_hint: riskLevel === "critical" ? "critical" : "medium",
    });
  }

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
