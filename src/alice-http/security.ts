// ─────────────────────────────────────────────────────────────
// ALICE WEBHOOK / HTTP ENTRY ADAPTER v1.0 — Security Gate
//
// Bounded v1 verification gate:
// - optional shared secret header check
// - request presence validation
// - reject obviously malformed requests
//
// No full vendor auth/signature system — just a basic guard.
// ─────────────────────────────────────────────────────────────

import type { AliceHttpRequestEnvelope } from "./types.js";

let _sharedSecret: string | null = null;

export function setSharedSecret(secret: string | null): void {
  _sharedSecret = secret;
}

export function hasExpectedSharedSecret(): boolean {
  return _sharedSecret !== null && _sharedSecret.length > 0;
}

export function verifyAliceHttpRequest(envelope: AliceHttpRequestEnvelope): { valid: boolean; reason?: string } {
  // If no shared secret configured, skip verification gate
  if (!hasExpectedSharedSecret()) {
    return { valid: true };
  }

  // Check for shared secret in headers
  const authHeader = envelope.headers["x-alice-secret"] ?? envelope.headers["X-Alice-Secret"] ?? "";

  if (authHeader !== _sharedSecret) {
    return { valid: false, reason: "Invalid or missing shared secret" };
  }

  return { valid: true };
}
