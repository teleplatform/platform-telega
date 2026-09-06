import * as fs from "fs";
import * as path from "path";

export type EvidenceTransport = "ollama" | "lmstudio" | "api" | "cloud";

const EVIDENCE_FILE = path.resolve(".data/local-provider-events.jsonl");

function ensureDir(): void {
  const dir = path.dirname(EVIDENCE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export type LocalProviderTraceEvent =
  | "local_provider_selected"
  | "local_provider_health_check_started"
  | "local_provider_health_check_passed"
  | "local_provider_health_check_failed"
  | "local_model_response_started"
  | "local_model_response_completed"
  | "local_model_response_failed"
  | "local_benchmark_started"
  | "local_benchmark_model_started"
  | "local_benchmark_model_completed"
  | "local_benchmark_model_failed"
  | "local_benchmark_completed"
  | "local_auto_started"
  | "local_auto_intent_resolved"
  | "local_auto_model_selected"
  | "local_auto_fallback_used"
  | "local_auto_completed"
  | "local_auto_failed"
  | "local_session_locked"
  | "local_session_unlocked"
  | "local_session_used"
  | "local_session_provider_changed"
  | "local_session_missing_provider"
  | "local_session_failed"
  | "local_timeout_started"
  | "local_timeout_triggered"
  | "local_failover_started"
  | "local_failover_model_failed"
  | "local_failover_model_succeeded"
  | "local_cloud_escape_started"
  | "local_cloud_escape_completed"
  | "local_cloud_escape_blocked"
  | "adaptive_router_started"
  | "adaptive_router_ranked"
  | "adaptive_router_selected"
  | "adaptive_router_fallback"
  | "adaptive_router_completed"
  | "local_outcome_positive"
  | "local_outcome_negative"
  | "local_retry_required"
  | "local_user_correction"
  | "local_followup_penalty"
  | "resource_snapshot_taken"
  | "resource_penalty_applied"
  | "resource_override_used"
  | "resource_low_memory_detected";

export function writeLocalProviderEvidence(
  event: LocalProviderTraceEvent,
  modelId: string,
  modelName: string,
  transport: EvidenceTransport,
  meta?: Record<string, unknown>
): void {
  try {
    ensureDir();
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      modelId,
      modelName: modelName.slice(0, 60),
      transport,
      ...(meta || {}),
    }) + "\n";
    fs.appendFileSync(EVIDENCE_FILE, line, "utf-8");
  } catch {
    // silent
  }
}

export function getLocalProviderTraceEvents(): unknown[] {
  try {
    if (!fs.existsSync(EVIDENCE_FILE)) return [];
    const raw = fs.readFileSync(EVIDENCE_FILE, "utf-8");
    return raw.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

export function clearLocalProviderTraceEvents(): void {
  try {
    if (fs.existsSync(EVIDENCE_FILE)) fs.unlinkSync(EVIDENCE_FILE);
  } catch {
    // silent
  }
}
