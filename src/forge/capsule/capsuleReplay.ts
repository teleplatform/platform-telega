import { CapsuleReplayPlan, CapsuleData } from "./capsuleTypes";
import { capsuleStore } from "./capsuleStore";

export function getReplayPlan(capsuleId: string): CapsuleReplayPlan | null {
  const capsule = capsuleStore.load(capsuleId);
  if (!capsule) return null;
  return capsule.replayPlan || buildReplayPlan(capsule);
}

function buildReplayPlan(capsule: CapsuleData): CapsuleReplayPlan {
  const results = capsule.results || [];
  const steps = results
    .filter((r: any) => r.jobNodeId)
    .map((r: any, i: number) => ({
      order: i + 1,
      agentRole: r.agentRole || "unknown",
      taskTitle: typeof r.output === "string" ? r.output.split(":")[0] || `Step ${i + 1}` : `Step ${i + 1}`,
      jobNodeId: r.jobNodeId,
      durationMs: r.durationMs || 0,
    }));

  return {
    capsuleId: capsule.manifest.capsuleId,
    steps,
    totalSteps: steps.length,
    estimatedReplayDurationMs: steps.reduce((s, st) => s + st.durationMs, 0),
  };
}

export function inspectCapsule(capsuleId: string): CapsuleData | null {
  return capsuleStore.load(capsuleId);
}

export function listCapsules(): CapsuleData[] {
  return capsuleStore.getAll();
}
