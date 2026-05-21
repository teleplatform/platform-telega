import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { compareRuntimeBaseline } from "./runtime-baseline.js";
import { checkRuntimeHealth } from "./runtime-health-aggregator.js";

export type DriftSeverity = "none" | "low" | "warning" | "high" | "failed";

export interface DriftGateResult {
  allowed: boolean;
  severity: DriftSeverity;
  reason?: string;
  details: string[];
  env_config: {
    enabled: boolean;
    max_severity: DriftSeverity;
  };
}

function getMaxSeverity(): DriftSeverity {
  const val = process.env.RUNTIME_DRIFT_MAX_SEVERITY || "warning";
  const valid: DriftSeverity[] = ["none", "low", "warning", "high", "failed"];
  return valid.includes(val as DriftSeverity) ? (val as DriftSeverity) : "warning";
}

function isEnabled(): boolean {
  return process.env.RUNTIME_DRIFT_GATE_ENABLED === "true";
}

const severityOrder: Record<DriftSeverity, number> = {
  none: 0,
  low: 1,
  warning: 2,
  high: 3,
  failed: 4,
};

function severityExceeds(a: DriftSeverity, b: DriftSeverity): boolean {
  return severityOrder[a] > severityOrder[b];
}

export async function checkRuntimeDriftGate(): Promise<DriftGateResult> {
  const enabled = isEnabled();
  const maxSeverity = getMaxSeverity();

  const details: string[] = [];

  if (!enabled) {
    const result: DriftGateResult = {
      allowed: true,
      severity: "none",
      reason: "drift gate disabled",
      details: ["RUNTIME_DRIFT_GATE_ENABLED=false"],
      env_config: { enabled, max_severity: maxSeverity },
    };
    await writeGateEvidence(result);
    return result;
  }

  let driftSeverity: DriftSeverity = "none";

  try {
    const { comparison } = await compareRuntimeBaseline();
    if (!comparison.package_version_same) {
      driftSeverity = "high";
      details.push(`package version drift: ${comparison.package_version_same ? "same" : "changed"}`);
    }
    if (!comparison.policy_hash_same) {
      if (severityOrder[driftSeverity] < 2) driftSeverity = "warning";
      details.push(`policy hash changed`);
    }
    if (!comparison.execution_policy_hash_same) {
      if (severityOrder[driftSeverity] < 2) driftSeverity = "warning";
      details.push(`execution policy hash changed`);
    }
    if (comparison.profile_count_changed) {
      if (severityOrder[driftSeverity] < 2) driftSeverity = "warning";
      details.push(`capability profile count changed`);
    }
  } catch {
    driftSeverity = "high";
    details.push("baseline comparison failed");
  }

  try {
    const health = await checkRuntimeHealth();
    if (health.status === "failed") {
      if (severityOrder[driftSeverity] < 3) driftSeverity = "failed";
      details.push(`runtime health: ${health.status}`);
    } else if (health.status === "degraded") {
      if (severityOrder[driftSeverity] < 2) driftSeverity = "warning";
      details.push(`runtime health: ${health.status}`);
    } else if (health.status === "warning") {
      details.push(`runtime health: ${health.status}`);
    }
  } catch {
    if (severityOrder[driftSeverity] < 3) driftSeverity = "failed";
    details.push("runtime health check failed");
  }

  const blocked = severityExceeds(driftSeverity, maxSeverity);

  const result: DriftGateResult = {
    allowed: !blocked,
    severity: driftSeverity,
    reason: blocked
      ? `drift severity ${driftSeverity} exceeds max ${maxSeverity}`
      : `drift severity ${driftSeverity} within limit ${maxSeverity}`,
    details,
    env_config: { enabled, max_severity: maxSeverity },
  };

  await writeGateEvidence(result);
  return result;
}

export function assertRuntimeDriftAllowed(result: DriftGateResult): void {
  if (!result.allowed) {
    throw new Error(`Drift gate blocked: ${result.reason}`);
  }
}

async function writeGateEvidence(result: DriftGateResult): Promise<void> {
  await appendEvidenceRecord({
    evidence_id: hashTraceId("drift-gate", result.allowed ? "runtime_drift_gate_checked" : "runtime_drift_gate_blocked"),
    trace_id: "drift-gate",
    job_id: "drift-gate",
    type: result.allowed ? "runtime_drift_gate_checked" : "runtime_drift_gate_blocked",
    timestamp: new Date().toISOString(),
    payload: {
      allowed: result.allowed,
      severity: result.severity,
      reason: result.reason,
      details: result.details,
      enabled: result.env_config.enabled,
      max_severity: result.env_config.max_severity,
    },
  });
}
