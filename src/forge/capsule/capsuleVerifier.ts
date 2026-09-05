import * as crypto from "crypto";
import * as fs from "fs";
import { CapsuleData, CapsuleVerification } from "./capsuleTypes";
import { capsuleStore } from "./capsuleStore";

export function verifyCapsule(capsuleId: string): CapsuleVerification {
  const capsule = capsuleStore.load(capsuleId);
  if (!capsule) {
    return {
      ok: false,
      checks: [{ name: "exists", passed: false, error: "Capsule not found" }],
      verifiedAt: Date.now(),
    };
  }

  const checks: CapsuleVerification["checks"] = [];

  // 1. Manifest exists
  checks.push({
    name: "manifest",
    passed: !!capsule.manifest,
    error: capsule.manifest ? undefined : "Manifest missing",
  });

  // 2. Graph exists
  checks.push({
    name: "graph",
    passed: !!capsule.graph,
    error: capsule.graph ? undefined : "Graph data missing",
  });

  // 3. Artifacts exist and hashes match
  let artifactsOk = true;
  for (const artifact of capsule.artifacts) {
    if (!fs.existsSync(artifact.path)) {
      artifactsOk = false;
      checks.push({
        name: `artifact:${artifact.path}`,
        passed: false,
        error: `File not found: ${artifact.path}`,
      });
      continue;
    }

    const content = fs.readFileSync(artifact.path);
    const currentHash = crypto.createHash("sha256").update(content).digest("hex");
    const hashMatch = currentHash === artifact.sha256;

    if (!hashMatch) {
      artifactsOk = false;
      checks.push({
        name: `artifact:${artifact.path}`,
        passed: false,
        error: `Hash mismatch: expected ${artifact.sha256}, got ${currentHash}`,
      });
    } else {
      checks.push({
        name: `artifact:${artifact.path}`,
        passed: true,
      });
    }
  }

  if (capsule.artifacts.length === 0) {
    checks.push({ name: "artifacts", passed: true });
  }

  // 4. Evidence exists
  checks.push({
    name: "evidence",
    passed: capsule.evidence.length > 0,
    error: capsule.evidence.length > 0 ? undefined : "No evidence records",
  });

  // 5. Status is valid
  const validStatuses = ["building", "completed", "failed", "verified"];
  checks.push({
    name: "status",
    passed: validStatuses.includes(capsule.manifest.status),
    error: validStatuses.includes(capsule.manifest.status) ? undefined : `Invalid status: ${capsule.manifest.status}`,
  });

  const allPassed = checks.every((c) => c.passed);
  const verification: CapsuleVerification = {
    ok: allPassed,
    checks,
    verifiedAt: Date.now(),
  };

  // Update capsule with verification
  capsule.manifest.verification = verification;
  if (allPassed) capsule.manifest.status = "verified";
  capsuleStore.save(capsule);

  return verification;
}
