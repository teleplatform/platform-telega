import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { CapsuleData, CapsuleManifest, CapsuleArtifact, CapsuleVerification, CapsuleReplayPlan } from "./capsuleTypes";
import { capsuleStore } from "./capsuleStore";

let counter = 0;
function genId(): string {
  counter++;
  return `cap_${Date.now()}_${counter}`;
}

export function buildCapsule(
  mission: string,
  graphId: string,
  graph: unknown,
  assignments: unknown[],
  results: unknown[],
  evidence: Array<{ kind: string; data: unknown }>,
  existingArtifacts: CapsuleArtifact[]
): CapsuleData {
  const now = Date.now();
  const capsuleId = genId();

  // Collect unique agent roles
  const agents = [...new Set(assignments.map((a: any) => a.agentRole).filter(Boolean))];

  // Build replay plan
  const steps = results
    .filter((r: any) => r.jobNodeId)
    .map((r: any, i: number) => ({
      order: i + 1,
      agentRole: r.agentRole || "unknown",
      taskTitle: r.output?.split(":")[0] || `Step ${i + 1}`,
      jobNodeId: r.jobNodeId,
      durationMs: r.durationMs || 0,
    }));

  const totalDurationMs = steps.reduce((s, st) => s + st.durationMs, 0);

  const replayPlan: CapsuleReplayPlan = {
    capsuleId,
    steps,
    totalSteps: steps.length,
    estimatedReplayDurationMs: totalDurationMs,
  };

  const manifest: CapsuleManifest = {
    capsuleId,
    version: "1.0",
    mission,
    graphId,
    status: "completed",
    createdAt: now,
    completedAt: now,
    agents,
    artifactCount: existingArtifacts.length,
    evidenceCount: evidence.length,
    verification: null,
  };

  const capsule: CapsuleData = {
    manifest,
    graph,
    assignments,
    results,
    evidence,
    artifacts: existingArtifacts,
    replayPlan,
  };

  // Store to disk
  capsuleStore.save(capsule);

  return capsule;
}

export function addArtifact(
  capsuleId: string,
  filePath: string,
  type: string,
  description: string
): CapsuleArtifact | null {
  const capsule = capsuleStore.load(capsuleId);
  if (!capsule) return null;

  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  const size = content.length;

  const artifact: CapsuleArtifact = {
    path: filePath,
    sha256: hash,
    size,
    type,
    description,
  };

  capsule.artifacts.push(artifact);
  capsule.manifest.artifactCount = capsule.artifacts.length;
  capsuleStore.save(capsule);

  return artifact;
}

export function finalizeCapsule(capsuleId: string): CapsuleData | null {
  const capsule = capsuleStore.load(capsuleId);
  if (!capsule) return null;

  capsule.manifest.completedAt = Date.now();
  capsule.manifest.status = "completed";
  capsuleStore.save(capsule);

  return capsule;
}
