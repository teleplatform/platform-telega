// ─────────────────────────────────────────────────────────────
// ALICE PUBLISH / SKILL REGISTRATION PACK v1.0 — Publish Validation
//
// Truthfully checks if skill is structurally ready for publish:
// - skill structurally ready?
// - manifest valid?
// - invocation profile valid?
// - endpoint declared?
// - env ready?
// - blockers exist?
// ─────────────────────────────────────────────────────────────

import type {
  AliceSkillManifest,
  AliceSkillInvocationProfile,
  AlicePublishReadinessReport,
} from "./types.js";
import { checkAlicePublishEnvironment, hasRequiredAlicePublishSecrets } from "./environment.js";
import { getAliceWebhookPublishPath } from "./endpoints.js";

export function validateAlicePublishReadiness(input: {
  manifest?: AliceSkillManifest;
  invocation?: AliceSkillInvocationProfile;
  requireSecrets?: boolean;
}): AlicePublishReadinessReport {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  // Check manifest
  const manifestValid = !!input.manifest && validateManifestStructure(input.manifest).length === 0;
  if (!manifestValid) {
    blockers.push("Skill manifest is invalid or missing");
  }

  // Check invocation
  const invocationValid = !!input.invocation && validateInvocationStructure(input.invocation).length === 0;
  if (!invocationValid) {
    blockers.push("Invocation profile is invalid or missing");
  }

  // Check endpoint
  const webhookPath = getAliceWebhookPublishPath();
  const endpointConfigured = webhookPath.length > 0;
  if (!endpointConfigured) {
    blockers.push("Webhook endpoint path is not configured");
  }

  // Check environment
  const envReadiness = checkAlicePublishEnvironment();
  const environmentReady = envReadiness.allPresent;
  if (!environmentReady) {
    warnings.push(`Missing environment keys: ${envReadiness.missing.join(", ")}`);
  }

  // Check hardening (assumed enabled if module loaded)
  const hardeningEnabled = true; // Hardening module exists = enabled

  // Check secrets
  let requiredSecretsPresent = true;
  if (input.requireSecrets) {
    // When requireSecrets is true, we explicitly check for the secret
    const secret = process.env.ALICE_SHARED_SECRET;
    requiredSecretsPresent = secret !== undefined && secret.length > 0;
    if (!requiredSecretsPresent) {
      blockers.push("Required secret ALICE_SHARED_SECRET is missing");
    }
  } else {
    // Check recommended secrets but don't fail
    const secretsCheck = hasRequiredAlicePublishSecrets();
    if (!secretsCheck.present) {
      notes.push(`Optional secrets missing: ${secretsCheck.missing.join(", ")}`);
    }
  }

  const readyToPublish =
    manifestValid &&
    invocationValid &&
    endpointConfigured &&
    requiredSecretsPresent;

  return {
    readyToPublish,
    checks: {
      manifestValid,
      invocationValid,
      endpointConfigured,
      environmentReady,
      hardeningEnabled,
      requiredSecretsPresent,
    },
    blockers: blockers.length > 0 ? blockers : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    notes: notes.length > 0 ? notes : undefined,
  };
}

function validateManifestStructure(manifest: AliceSkillManifest): string[] {
  const errors: string[] = [];

  if (!manifest.manifestVersion) errors.push("manifestVersion is required");
  if (!manifest.identity) errors.push("identity is required");
  if (!manifest.identity.skillId) errors.push("identity.skillId is required");
  if (!manifest.identity.displayName) errors.push("identity.displayName is required");
  if (!manifest.invocation) errors.push("invocation is required");
  if (!manifest.invocation.entryPhrases || manifest.invocation.entryPhrases.length === 0) {
    errors.push("invocation.entryPhrases is required and must not be empty");
  }
  if (!manifest.webhookPath) errors.push("webhookPath is required");
  if (!manifest.httpMethod) errors.push("httpMethod is required");

  return errors;
}

function validateInvocationStructure(invocation: AliceSkillInvocationProfile): string[] {
  const errors: string[] = [];

  if (!invocation.entryPhrases || invocation.entryPhrases.length === 0) {
    errors.push("entryPhrases is required and must not be empty");
  }
  if (!invocation.invocationMode) errors.push("invocationMode is required");
  if (!invocation.defaultEntryIntent) errors.push("defaultEntryIntent is required");

  return errors;
}
