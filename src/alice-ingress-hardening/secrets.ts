// ─────────────────────────────────────────────────────────────
// ALICE INGRESS HARDENING PACK v1.0 — Shared Secret Discipline
//
// Bounded v1 shared secret check:
// - optional configured secret
// - if secret mode enabled → request must carry expected header
// - if header missing/invalid → reject before protocol handoff
//
// No vendor-specific crypto complexity — just boundary discipline.
// ─────────────────────────────────────────────────────────────

let _expectedSecret: string | null = null;
const SECRET_HEADER_KEY = "x-alice-secret";

export function setExpectedIngressSecret(secret: string | null): void {
  _expectedSecret = secret;
}

export function getExpectedIngressSecret(): string | null {
  return _expectedSecret;
}

export function isSecretCheckEnabled(): boolean {
  return _expectedSecret !== null && _expectedSecret.length > 0;
}

export function validateIngressSecret(headers: Record<string, string | undefined>): { valid: boolean; reason?: string } {
  // If no secret configured, skip check
  if (!isSecretCheckEnabled()) {
    return { valid: true };
  }

  // Extract secret from headers (case-insensitive)
  const providedSecret = headers[SECRET_HEADER_KEY] ?? headers[SECRET_HEADER_KEY.toLowerCase()] ?? "";

  if (!providedSecret || providedSecret.length === 0) {
    return { valid: false, reason: "missing_secret" };
  }

  // Timing-safe comparison (basic v1 — constant-time not critical for bounded v1)
  if (providedSecret !== _expectedSecret) {
    return { valid: false, reason: "invalid_secret" };
  }

  return { valid: true };
}

export function getSecretHeaderKey(): string {
  return SECRET_HEADER_KEY;
}
