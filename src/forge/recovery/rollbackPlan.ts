import { RollbackPlan, RollbackStep, RecoveryPoint } from "./recoveryTypes";
import { getRecoveryPoint } from "./recoveryPoint";

let counter = 0;
function genId(): string {
  counter++;
  return `rb_${Date.now()}_${counter}`;
}

export function buildRollbackPlan(
  recoveryPointId: string,
  failedJobNodeId: string,
  reason: string,
  impactedFiles: string[],
  impactedArtifacts: string[]
): RollbackPlan | null {
  const point = getRecoveryPoint(recoveryPointId);
  if (!point) return null;

  const steps: RollbackStep[] = [];

  // 1. Restore files to recovery point state
  for (const file of impactedFiles) {
    const fh = point.fileHashes.find((h) => h.file === file);
    if (fh) {
      steps.push({ kind: "restore_file", target: file, value: fh.sha256 });
    }
  }

  // 2. Delete post-point artifacts
  for (const artifact of impactedArtifacts) {
    steps.push({ kind: "delete_artifact", target: artifact });
  }

  // 3. Reset the failed job
  steps.push({ kind: "reset_job", target: failedJobNodeId });

  const estimatedImpact = [...new Set([...impactedFiles, ...impactedArtifacts])];

  return {
    id: genId(),
    recoveryPointId,
    reason,
    steps,
    estimatedImpact,
    createdAt: Date.now(),
  };
}
