import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const AUDIT_DIR = path.join(process.cwd(), "data", "creator-bridge");
const AUDIT_FILE = path.join(AUDIT_DIR, "audit.jsonl");
const MAX_AUDIT = 10000;

export type ActionType = "strategy" | "job" | "tool" | "patch_plan" | "patch_apply" | "router" | "governor";
export type RiskLevel = "low" | "medium" | "high";
export type GuardrailResult = "passed" | "failed";

export interface AuditRecord {
  audit_id: string;
  request_id: string;
  user_id: string;
  role: string;
  action_type: ActionType;
  input_summary: string;
  strategy_mode?: string;
  providers_used?: string[];
  tools_used?: string[];
  patch_id?: string;
  apply_id?: string;
  decision_reasoning: string;
  guardrail_result: GuardrailResult;
  guardrail_reason?: string;
  governor_state?: {
    user_active: number;
    global_active: number;
    provider_load?: string;
  };
  outcome: "success" | "failed" | "pending" | "rolled_back";
  latency_ms?: number;
  timestamp: number;
  risk_level?: RiskLevel;
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(AUDIT_DIR, { recursive: true });
  } catch {}
}

async function appendAudit(record: AuditRecord): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(record) + "\n";
    await fs.appendFile(AUDIT_FILE, line, "utf-8");
  } catch (e) {
    console.error("[audit] write failed", e);
  }
}

export function generateAuditId(): string {
  return `audit-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
}

export async function writeAudit(
  requestId: string,
  userId: string,
  role: string,
  actionType: ActionType,
  inputSummary: string,
  decisionReasoning: string,
  guardrailResult: GuardrailResult,
  outcome: AuditRecord["outcome"],
  options?: {
    strategyMode?: string;
    providersUsed?: string[];
    toolsUsed?: string[];
    patchId?: string;
    applyId?: string;
    guardrailReason?: string;
    governorState?: AuditRecord["governor_state"];
    latencyMs?: number;
    riskLevel?: RiskLevel;
  }
): Promise<void> {
  const record: AuditRecord = {
    audit_id: generateAuditId(),
    request_id: requestId,
    user_id: userId,
    role,
    action_type: actionType,
    input_summary: inputSummary.slice(0, 500),
    decision_reasoning: decisionReasoning.slice(0, 1000),
    guardrail_result: guardrailResult,
    outcome,
    timestamp: Date.now(),
    ...options,
  };
  
  await appendAudit(record);
  console.log("[audit]", actionType, outcome, record.audit_id);
}

export async function loadAudit(limit = MAX_AUDIT): Promise<AuditRecord[]> {
  const records: AuditRecord[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(AUDIT_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const recent = lines.slice(-limit);
    for (const line of recent) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.audit_id) {
          records.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return records;
}

export async function findAudit(query: string, limit = 10): Promise<AuditRecord[]> {
  const records = await loadAudit(500);
  const lower = query.toLowerCase();
  return records
    .filter(r => 
      r.input_summary.toLowerCase().includes(lower) ||
      r.decision_reasoning.toLowerCase().includes(lower) ||
      r.action_type.includes(lower) ||
      r.user_id.includes(lower)
    )
    .slice(0, limit);
}

export async function getAuditById(auditId: string): Promise<AuditRecord | undefined> {
  const records = await loadAudit(1000);
  return records.find(r => r.audit_id === auditId);
}

export function computeRiskLevel(
  actionType: ActionType,
  providersUsed?: string[],
  toolsUsed?: string[],
  isMultiFile?: boolean
): RiskLevel {
  if (actionType === "patch_apply") {
    if (isMultiFile) return "high";
    return "medium";
  }
  
  if (toolsUsed && toolsUsed.length > 0) {
    return "medium";
  }
  
  if (providersUsed && providersUsed.length > 2) {
    return "medium";
  }
  
  return "low";
}

export async function formatAuditSummary(limit = 10): Promise<string> {
  const records = await loadAudit(limit);
  const recent = records.slice(0, limit);
  
  const lines = ["📋 Audit Summary"];
  
  const stats = {
    success: records.filter(r => r.outcome === "success").length,
    failed: records.filter(r => r.outcome === "failed").length,
    pending: records.filter(r => r.outcome === "pending").length,
  };
  
  lines.push(`Total: ${records.length}, Success: ${stats.success}, Failed: ${stats.failed}`);
  lines.push("\nRecent:");
  
  for (const r of recent) {
    const outcome = r.outcome === "success" ? "✅" : r.outcome === "failed" ? "❌" : "⏳";
    const risk = r.risk_level === "high" ? "🔴" : r.risk_level === "medium" ? "🟡" : "🟢";
    lines.push(`${outcome}${risk} ${r.action_type}: ${r.input_summary.slice(0, 50)}...`);
  }
  
  return lines.join("\n");
}

export async function formatAuditRecord(record: AuditRecord): Promise<string> {
  const lines = [
    `📋 Audit: ${record.audit_id}`,
    `Request: ${record.request_id}`,
    `User: ${record.user_id} (${record.role})`,
    `Action: ${record.action_type}`,
    `Risk: ${record.risk_level || "low"}`,
    `Input: ${record.input_summary.slice(0, 200)}`,
    `Reasoning: ${record.decision_reasoning.slice(0, 300)}`,
    `Guardrail: ${record.guardrail_result}${record.guardrail_reason ? ` - ${record.guardrail_reason}` : ""}`,
    `Outcome: ${record.outcome}`,
    `Time: ${new Date(record.timestamp).toLocaleString()}`,
  ];
  
  if (record.providers_used?.length) {
    lines.push(`Providers: ${record.providers_used.join(" → ")}`);
  }
  
  if (record.tools_used?.length) {
    lines.push(`Tools: ${record.tools_used.join(", ")}`);
  }
  
  if (record.patch_id) lines.push(`Patch: ${record.patch_id}`);
  if (record.apply_id) lines.push(`Apply: ${record.apply_id}`);
  if (record.latency_ms) lines.push(`Latency: ${record.latency_ms}ms`);
  
  return lines.join("\n");
}