import type { RunLedger } from "../../fsgr-contracts/src/index.js";

export function validateRunNodeConsistency(run: RunLedger | null, nodes: any[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!run) return { ok: false, errors: ["run is null"] };
  if (nodes.some((n) => n.run_id !== run.run_id)) {
    errors.push("nodes belong to different run");
  }
  return { ok: errors.length === 0, errors };
}

export function validateArtifactRunConsistency(run: RunLedger | null, artifacts: any[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!run) return { ok: false, errors: ["run is null"] };
  if (artifacts.some((a) => a.run_id !== run.run_id)) {
    errors.push("artifacts belong to different run");
  }
  return { ok: errors.length === 0, errors };
}

export function validateCapsuleRunConsistency(run: RunLedger | null, capsule: any): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!run) return { ok: false, errors: ["run is null"] };
  if (!capsule) return { ok: false, errors: ["capsule is null"] };
  const capsuleData = typeof capsule === "string" ? JSON.parse(capsule) : capsule;
  const capsuleJson = capsuleData.capsule_json ? JSON.parse(capsuleData.capsule_json) : capsuleData;
  if (capsuleJson.run_id !== run.run_id) {
    errors.push("capsule belongs to different run");
  }
  return { ok: errors.length === 0, errors };
}
