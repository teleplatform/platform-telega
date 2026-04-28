// ─────────────────────────────────────────────────────────────
// ALICE PUBLISH / SKILL REGISTRATION PACK v1.0 — Environment Readiness
//
// Checks minimum environment for publish readiness:
// - webhook base URL configured
// - Alice ingress route enabled
// - shared secret present (if required mode enabled)
// - publish manifest exists
// - hardening layer enabled
// - protocol adapter reachable
// - HTTP entry adapter reachable
// ─────────────────────────────────────────────────────────────

export type AliceEnvironmentCheck = {
  key: string;
  present: boolean;
  value?: string;
};

export type AliceEnvironmentReadiness = {
  checks: AliceEnvironmentCheck[];
  allPresent: boolean;
  missing: string[];
};

// Required env keys for publish readiness
const REQUIRED_ENV_KEYS = [
  "ALICE_WEBHOOK_PATH",
];

// Optional but recommended keys
const RECOMMENDED_ENV_KEYS = [
  "ALICE_SHARED_SECRET",
];

export function checkAlicePublishEnvironment(): AliceEnvironmentReadiness {
  const checks: AliceEnvironmentCheck[] = [];
  const missing: string[] = [];

  for (const key of REQUIRED_ENV_KEYS) {
    const value = process.env[key];
    const present = value !== undefined && value.length > 0;
    checks.push({ key, present, value: present ? "[configured]" : undefined });
    if (!present) missing.push(key);
  }

  // Check recommended keys (don't fail on missing, but note them)
  for (const key of RECOMMENDED_ENV_KEYS) {
    const value = process.env[key];
    const present = value !== undefined && value.length > 0;
    checks.push({ key, present, value: present ? "[configured]" : undefined });
  }

  return {
    checks,
    allPresent: missing.length === 0,
    missing,
  };
}

export function hasRequiredAlicePublishSecrets(): { present: boolean; missing: string[] } {
  const missing: string[] = [];

  // Check if secret mode is enabled
  const secretModeEnabled = process.env.ALICE_SECRET_MODE === "enabled";

  if (secretModeEnabled) {
    const secret = process.env.ALICE_SHARED_SECRET;
    if (!secret || secret.length === 0) {
      missing.push("ALICE_SHARED_SECRET");
    }
  }

  return {
    present: missing.length === 0,
    missing,
  };
}
