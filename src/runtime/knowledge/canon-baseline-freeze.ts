import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getActiveCanons } from "./strategic-canon-registry.js";

const BASELINE_DIR = path.join(process.cwd(), ".data", "canon");
const BASELINE_PATH = path.join(BASELINE_DIR, "canon-baseline.json");

export interface CanonBaseline {
  created_at: string;
  active_canons: number;
  canon_ids: string[];
}

export async function freezeCanonBaseline(): Promise<CanonBaseline> {
  const active = getActiveCanons();

  const baseline: CanonBaseline = {
    created_at: new Date().toISOString(),
    active_canons: active.length,
    canon_ids: active.map((c) => c.canon_id),
  };

  if (!fs.existsSync(BASELINE_DIR)) {
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
  }
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2), { encoding: "utf8" });

  await appendEvidenceRecord({
    evidence_id: hashTraceId("canon_baseline", "canon_baseline_frozen"),
    trace_id: "canon_baseline",
    job_id: "knowledge",
    type: "canon_baseline_frozen",
    timestamp: baseline.created_at,
    payload: { active_canons: active.length },
  });

  return baseline;
}

export async function compareCanonBaseline(): Promise<{
  previous: CanonBaseline | null;
  current: CanonBaseline;
  differences: string[];
}> {
  let previous: CanonBaseline | null = null;
  if (fs.existsSync(BASELINE_PATH)) {
    try {
      previous = JSON.parse(fs.readFileSync(BASELINE_PATH, { encoding: "utf8" }));
    } catch {}
  }

  const current = await freezeCanonBaseline();
  const differences: string[] = [];

  if (previous) {
    if (previous.active_canons !== current.active_canons) {
      differences.push(`active canons: ${previous.active_canons} → ${current.active_canons}`);
    }
    const newIds = current.canon_ids.filter((id) => !previous.canon_ids.includes(id));
    const removedIds = previous.canon_ids.filter((id) => !current.canon_ids.includes(id));
    if (newIds.length > 0) differences.push(`new canons: ${newIds.join(", ")}`);
    if (removedIds.length > 0) differences.push(`removed canons: ${removedIds.join(", ")}`);
  }

  await appendEvidenceRecord({
    evidence_id: hashTraceId("canon_baseline_compare", "canon_baseline_compared"),
    trace_id: "canon_baseline",
    job_id: "knowledge",
    type: "canon_baseline_compared",
    timestamp: current.created_at,
    payload: {
      has_previous: !!previous,
      differences_count: differences.length,
      differences,
    },
  });

  return { previous, current, differences };
}
