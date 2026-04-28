import { promises as fs } from "node:fs";
import * as path from "node:path";
import crypto from "node:crypto";

export type CreatorWebTraceRow = {
  trace_id: string;
  provider_id: string;
  source_url: string;
  policy_id: string;
  usage_scope: "personal_internal";
  vendor_approval: "confirmed";
  action_type: "open" | "send" | "wait" | "read" | "select" | "health" | "login" | "relogin_required";
  delay_applied_ms: number;
  policy_verdict: "allowed" | "slow_mode" | "paused" | "blocked";
  created_at: string;
  meta: Record<string, any>;
};

function traceFilePath(): string {
  return (
    process.env.TELEGPT_CREATOR_WEB_TRACE_PATH ||
    process.env.TELEGPT_CREATOR_WEB_TRACE_FILE ||
    path.join(process.cwd(), ".telegpt", "creator-web-trace.jsonl")
  );
}

export async function appendCreatorWebTrace(
  row: Omit<CreatorWebTraceRow, "trace_id" | "created_at"> & {
    trace_id?: string;
    created_at?: string;
  }
) {
  const outPath = traceFilePath();
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  const full: CreatorWebTraceRow = {
    trace_id: row.trace_id ?? crypto.randomUUID(),
    created_at: row.created_at ?? new Date().toISOString(),
    provider_id: row.provider_id,
    source_url: row.source_url,
    policy_id: row.policy_id,
    usage_scope: "personal_internal",
    vendor_approval: "confirmed",
    action_type: row.action_type,
    delay_applied_ms: row.delay_applied_ms ?? 0,
    policy_verdict: row.policy_verdict,
    meta: row.meta ?? {},
  };

  await fs.appendFile(outPath, JSON.stringify(full) + "\n", "utf8");
  return full.trace_id;
}
