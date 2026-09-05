import * as crypto from "crypto";
import * as fs from "fs";
import { RecoveryPoint, RecoveryStatus } from "./recoveryTypes";

const points: Map<string, RecoveryPoint> = new Map();

let counter = 0;
function genId(): string {
  counter++;
  return `rp_${Date.now()}_${counter}`;
}

function computeFileHash(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
  } catch {
    return null;
  }
}

export function createRecoveryPoint(
  graphId: string,
  jobNodeId: string | null,
  capsuleId: string | null,
  reason: string,
  files: string[],
  artifacts: string[]
): RecoveryPoint {
  const fileHashes = files
    .map((f) => ({ file: f, sha256: computeFileHash(f) || "" }))
    .filter((f) => f.sha256);

  const point: RecoveryPoint = {
    id: genId(),
    graphId,
    jobNodeId,
    capsuleId,
    status: "safe",
    fileHashes,
    artifacts,
    reason,
    createdAt: Date.now(),
    rolledBackAt: null,
  };

  points.set(point.id, point);
  return point;
}

export function getRecoveryPoint(id: string): RecoveryPoint | undefined {
  return points.get(id);
}

export function listRecoveryPoints(graphId?: string): RecoveryPoint[] {
  const all = Array.from(points.values());
  if (graphId) return all.filter((p) => p.graphId === graphId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export function verifyRecoveryPoint(id: string): { ok: boolean; mismatches: string[] } {
  const point = points.get(id);
  if (!point) return { ok: false, mismatches: ["Recovery point not found"] };

  const mismatches: string[] = [];
  for (const fh of point.fileHashes) {
    const currentHash = computeFileHash(fh.file);
    if (currentHash === null) {
      mismatches.push(`File missing: ${fh.file}`);
    } else if (currentHash !== fh.sha256) {
      mismatches.push(`Hash mismatch: ${fh.file}`);
    }
  }

  return { ok: mismatches.length === 0, mismatches };
}

export function updatePointStatus(id: string, status: RecoveryStatus): RecoveryPoint | null {
  const point = points.get(id);
  if (!point) return null;
  point.status = status;
  if (status === "rolled_back") point.rolledBackAt = Date.now();
  return point;
}

export function getLastSafePoint(graphId: string): RecoveryPoint | undefined {
  return listRecoveryPoints(graphId).find((p) => p.status === "safe" || p.status === "resumed");
}
