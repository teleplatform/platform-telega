// ─────────────────────────────────────────────────────────────
// ALICE PUBLISH / SKILL REGISTRATION PACK v1.0 — Skill Manifest
//
// Machine-readable launch contract describing:
// - identity
// - invocation
// - webhook path
// - protocol expectations
// - readiness flags
// ─────────────────────────────────────────────────────────────

import type { AliceSkillManifest, AliceSkillIdentity, AliceSkillInvocationProfile } from "./types.js";
import { getAliceWebhookPublishPath } from "./endpoints.js";

export function buildAliceSkillManifest(input: {
  identity: AliceSkillIdentity;
  invocation: AliceSkillInvocationProfile;
  readiness?: {
    ingressReady?: boolean;
    protocolReady?: boolean;
    bridgeReady?: boolean;
    hardeningReady?: boolean;
  };
}): AliceSkillManifest {
  return {
    manifestVersion: "1.0",
    identity: input.identity,
    invocation: input.invocation,
    webhookPath: getAliceWebhookPublishPath(),
    httpMethod: "POST",
    contentType: "application/json",
    readiness: {
      ingressReady: input.readiness?.ingressReady ?? true,
      protocolReady: input.readiness?.protocolReady ?? true,
      bridgeReady: input.readiness?.bridgeReady ?? true,
      hardeningReady: input.readiness?.hardeningReady ?? true,
    },
  };
}

export function serializeAliceSkillManifest(manifest: AliceSkillManifest): string {
  return JSON.stringify(manifest, null, 2);
}

export function parseAliceSkillManifest(json: string): AliceSkillManifest | null {
  try {
    return JSON.parse(json) as AliceSkillManifest;
  } catch {
    return null;
  }
}
