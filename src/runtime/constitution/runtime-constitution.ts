import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type ConstitutionRuleType =
  | "no_silent_modification"
  | "creator_sovereignty"
  | "evidence_before_claim"
  | "rollback_required"
  | "approval_mandatory"
  | "audit_trail_mandatory"
  | "emergency_freeze_allowed";

export type ConstitutionalViolationSeverity =
  | "warning"
  | "major"
  | "critical"
  | "civilization_risk";

export interface ConstitutionRule {
  rule_id: string;
  type: ConstitutionRuleType;
  description: string;
  severity: "required" | "mandatory" | "critical";
  immutable: boolean;
  precedence: number; // Higher number = higher precedence
}

export interface ConstitutionalState {
  epoch: string;
  version: string;
  rules_active: ConstitutionRule[];
  violations: ConstitutionalViolation[];
  emergency_freeze_active: boolean;
  last_check: string;
  sovereignty_frozen: boolean;
  autonomy_disabled: boolean;
  replay_disabled: boolean;
  remote_execution_disabled: boolean;
}

export interface ConstitutionalViolation {
  violation_id: string;
  rule_id: string;
  actor: string;
  attempted_action: string;
  severity: ConstitutionalViolationSeverity;
  blocked: boolean;
  timestamp: string;
  evidence_id?: string;
}

// Immutable constitutional clauses
const IMMUTABLE_CLAUSES = {
  silent_self_modification: false,
  evidence_before_claim: true,
  approval_before_dangerous_execution: true,
  creator_override_always_allowed: true,
  rollback_required: true,
} as const;

// Constitutional rule precedence hierarchy (higher = more authoritative)
const RULE_PRECEDENCE: Record<ConstitutionRuleType, number> = {
  creator_sovereignty: 1000,
  no_silent_modification: 950,
  evidence_before_claim: 900,
  rollback_required: 850,
  approval_mandatory: 800,
  audit_trail_mandatory: 750,
  emergency_freeze_allowed: 700,
};

const CONSTITUTION_RULES: ConstitutionRule[] = [
  {
    rule_id: "const_rule_001",
    type: "no_silent_modification",
    description: "No silent self-modification without explicit approval",
    severity: "critical",
    immutable: true,
    precedence: RULE_PRECEDENCE.no_silent_modification,
  },
  {
    rule_id: "const_rule_002",
    type: "creator_sovereignty",
    description: "Creator has ultimate authority over runtime behavior",
    severity: "required",
    immutable: true,
    precedence: RULE_PRECEDENCE.creator_sovereignty,
  },
  {
    rule_id: "const_rule_003",
    type: "evidence_before_claim",
    description: "All claims must be backed by verifiable evidence",
    severity: "mandatory",
    immutable: true,
    precedence: RULE_PRECEDENCE.evidence_before_claim,
  },
  {
    rule_id: "const_rule_004",
    type: "rollback_required",
    description: "All modifications must be reversible",
    severity: "required",
    immutable: true,
    precedence: RULE_PRECEDENCE.rollback_required,
  },
  {
    rule_id: "const_rule_005",
    type: "approval_mandatory",
    description: "Dangerous actions require explicit approval",
    severity: "mandatory",
    immutable: true,
    precedence: RULE_PRECEDENCE.approval_mandatory,
  },
  {
    rule_id: "const_rule_006",
    type: "audit_trail_mandatory",
    description: "All significant actions must leave an audit trail",
    severity: "mandatory",
    immutable: true,
    precedence: RULE_PRECEDENCE.audit_trail_mandatory,
  },
  {
    rule_id: "const_rule_007",
    type: "emergency_freeze_allowed",
    description: "Constitution can trigger emergency freezes",
    severity: "critical",
    immutable: true,
    precedence: RULE_PRECEDENCE.emergency_freeze_allowed,
  },
];

let state: ConstitutionalState = {
  epoch: "bootstrap",
  version: "1.0.0",
  rules_active: [...CONSTITUTION_RULES],
  violations: [],
  emergency_freeze_active: false,
  last_check: new Date().toISOString(),
  sovereignty_frozen: false,
  autonomy_disabled: false,
  replay_disabled: false,
  remote_execution_disabled: false,
};

// Initialize constitution evidence
appendEvidenceRecord({
  evidence_id: hashTraceId("constitution_init", "runtime_constitution_loaded"),
  trace_id: "constitution_init",
  job_id: "constitution",
  type: "runtime_constitution_loaded",
  timestamp: new Date().toISOString(),
  payload: {
    version: state.version,
    rules_count: state.rules_active.length,
  },
}).catch(console.error);

export function getConstitutionState(): ConstitutionalState {
  return { ...state };
}

export function getConstitutionPrecedence(): Record<ConstitutionRuleType, number> {
  return { ...RULE_PRECEDENCE };
}

export function getImmutableClauses() {
  return { ...IMMUTABLE_CLAUSES };
}

export function checkConstitution(action: string, actor: string): {
  allowed: boolean;
  violations: ConstitutionalViolation[];
  highest_precedence_violation?: ConstitutionalViolation;
} {
  state.last_check = new Date().toISOString();
  const violations: ConstitutionalViolation[] = [];

  for (const rule of state.rules_active) {
    let violationSeverity: ConstitutionalViolationSeverity | undefined = undefined;
    let blocked = false;

    // Check for silent modification attempts
    if (
      action.includes("silent_modify") ||
      action.includes("modify_without_approval") ||
      (action.includes("update") && !action.includes("approval"))
    ) {
      if (rule.type === "no_silent_modification") {
        violationSeverity = "critical";
        blocked = rule.severity === "critical";
      }
    }

    // Check for evidence requirements
    if (action.includes("claim") || action.includes("assert")) {
      if (
        !action.includes("evidence") &&
        rule.type === "evidence_before_claim"
      ) {
        violationSeverity = "major";
        blocked = rule.severity === "mandatory" || rule.severity === "critical";
      }
    }

    // Check for creator sovereignty violations
    if (
      action.includes("override_creator") ||
      action.includes("bypass_sovereignty")
    ) {
      if (rule.type === "creator_sovereignty") {
        violationSeverity = "civilization_risk";
        blocked = true;
      }
    }

    if (violationSeverity !== undefined) {
      const violation: ConstitutionalViolation = {
        violation_id: `viol_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        rule_id: rule.rule_id,
        actor,
        attempted_action: action,
        severity: violationSeverity,
        blocked,
        timestamp: new Date().toISOString(),
      };
      violations.push(violation);
      state.violations.push(violation);

      // Log evidence for violation
      appendEvidenceRecord({
        evidence_id: hashTraceId(violation.violation_id, "runtime_constitution_violation_detected"),
        trace_id: violation.violation_id,
        job_id: "constitution",
        type: "runtime_constitution_violation_detected",
        timestamp: violation.timestamp,
        payload: {
          violation_id: violation.violation_id,
          rule_id: violation.rule_id,
          actor: violation.actor,
          action: violation.attempted_action,
          severity: violation.severity,
        },
      }).catch(console.error);
    }
  }

  // Find highest precedence violation
  const highestPrecedenceViolation = violations
    .sort(
      (a, b) =>
        (state.rules_active.find((r) => r.rule_id === b.rule_id)?.precedence ||
          0) -
        (state.rules_active.find((r) => r.rule_id === a.rule_id)?.precedence ||
          0)
    )[0];

  return {
    allowed:
      violations.length === 0 ||
      violations.every((v) => !v.blocked || v.severity === "warning"),
    violations,
    highest_precedence_violation:
      highestPrecedenceViolation?.blocked === true
        ? highestPrecedenceViolation
        : undefined,
  };
}

export async function enforceConstitution(
  action: string,
  actor: string,
): Promise<{ allowed: boolean; violations: ConstitutionalViolation[] }> {
  const result = checkConstitution(action, actor);

  // If there are blocking violations, prevent the action
  const hasBlockingViolation = result.violations.some(
    (v) => v.blocked && v.severity !== "warning",
  );

  if (hasBlockingViolation) {
    // Log the prevention
    await appendEvidenceRecord({
      evidence_id: hashTraceId(`prevent_${Date.now()}`, "constitution_action_prevented"),
      trace_id: `prevent_${Date.now()}`,
      job_id: "constitution",
      type: "governed_autonomy_blocked",
      timestamp: new Date().toISOString(),
      payload: {
        action,
        actor,
        violations_count: result.violations.filter((v) => v.blocked).length,
      },
    }).catch(console.error);
  }

  return result;
}

/**
 * Emergency freeze functions - triggered by constitution
 */
export async function freezeRuntime(): Promise<void> {
  state.emergency_freeze_active = true;
  state.sovereignty_frozen = true;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`freeze_runtime_${Date.now()}`, "runtime_constitution_emergency_freeze"),
    trace_id: `freeze_runtime_${Date.now()}`,
    job_id: "constitution",
    type: "runtime_constitution_emergency_freeze",
    timestamp: new Date().toISOString(),
    payload: { action: "freezeRuntime" },
  }).catch(console.error);
}

export async function freezeFederation(): Promise<void> {
  state.emergency_freeze_active = true;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`freeze_fed_${Date.now()}`, "runtime_sovereignty_frozen"),
    trace_id: `freeze_fed_${Date.now()}`,
    job_id: "constitution",
    type: "runtime_sovereignty_frozen",
    timestamp: new Date().toISOString(),
    payload: { action: "freezeFederation" },
  }).catch(console.error);
}

export async function disableAutonomy(): Promise<void> {
  state.autonomy_disabled = true;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`disable_auto_${Date.now()}`, "runtime_autonomy_disabled"),
    trace_id: `disable_auto_${Date.now()}`,
    job_id: "constitution",
    type: "runtime_autonomy_disabled",
    timestamp: new Date().toISOString(),
    payload: { action: "disableAutonomy" },
  }).catch(console.error);
}

export async function disableReplay(): Promise<void> {
  state.replay_disabled = true;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`disable_replay_${Date.now()}`, "runtime_replay_disabled"),
    trace_id: `disable_replay_${Date.now()}`,
    job_id: "constitution",
    type: "runtime_replay_disabled",
    timestamp: new Date().toISOString(),
    payload: { action: "disableReplay" },
  }).catch(console.error);
}

export async function disableRemoteExecution(): Promise<void> {
  state.remote_execution_disabled = true;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`disable_remote_${Date.now()}`, "runtime_remote_execution_disabled"),
    trace_id: `disable_remote_${Date.now()}`,
    job_id: "constitution",
    type: "runtime_remote_execution_disabled",
    timestamp: new Date().toISOString(),
    payload: { action: "disableRemoteExecution" },
  }).catch(console.error);
}

export function getConstitutionStatus(): {
  emergency_freeze: boolean;
  sovereignty_frozen: boolean;
  autonomy_disabled: boolean;
  replay_disabled: boolean;
  remote_execution_disabled: boolean;
  violation_count: number;
  critical_violations: number;
} {
  const criticalViolations = state.violations.filter(
    (v) => v.severity === "critical" || v.severity === "civilization_risk",
  ).length;

  return {
    emergency_freeze: state.emergency_freeze_active,
    sovereignty_frozen: state.sovereignty_frozen,
    autonomy_disabled: state.autonomy_disabled,
    replay_disabled: state.replay_disabled,
    remote_execution_disabled: state.remote_execution_disabled,
    violation_count: state.violations.length,
    critical_violations: criticalViolations,
  };
}