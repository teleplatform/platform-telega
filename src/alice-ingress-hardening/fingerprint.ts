// ─────────────────────────────────────────────────────────────
// ALICE INGRESS HARDENING PACK v1.0 — Fingerprint Helpers
//
// Any ingress request must receive a stable fingerprint.
// Based on bounded safe fields:
// - session id, user id, normalized body hash, content-type, timestamp bucket
//
// Without storing raw dangerous payloads as primary key.
// ─────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type { AliceIngressFingerprint } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function buildIngressFingerprint(input: {
  sessionId?: string;
  userId?: string;
  body: unknown;
  contentType?: string;
  receivedAt?: string;
}): AliceIngressFingerprint {
  const requestHash = hashIngressPayload(input);

  return {
    fingerprintId: crypto.randomUUID(),
    sessionId: input.sessionId,
    userId: input.userId,
    requestHash,
    contentType: input.contentType,
    receivedAt: input.receivedAt ?? nowIso(),
  };
}

export function hashIngressPayload(input: {
  sessionId?: string;
  userId?: string;
  body: unknown;
  contentType?: string;
}): string {
  // Hash only safe fields, not raw payload
  const safeInput = {
    s: input.sessionId ?? "",
    u: input.userId ?? "",
    c: input.contentType ?? "",
    // Hash body separately to avoid including raw content
    b: typeof input.body === "object" && input.body !== null
      ? hashObjectKeys(input.body as Record<string, unknown>)
      : "",
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(safeInput))
    .digest("hex")
    .slice(0, 16);
}

// Hash only the keys of an object, not values (safe for fingerprinting)
function hashObjectKeys(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  return crypto.createHash("sha256").update(JSON.stringify(keys)).digest("hex").slice(0, 8);
}

export function fingerprintsMatch(a: AliceIngressFingerprint, b: AliceIngressFingerprint): boolean {
  return a.requestHash === b.requestHash && a.sessionId === b.sessionId;
}
