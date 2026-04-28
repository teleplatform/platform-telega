// ─────────────────────────────────────────────────────────────
// ALICE INGRESS HARDENING PACK v1.0 — Boundary Guards
//
// Oversize and malformed request guards.
// Reject before protocol handoff — don't try to "somehow chew" junk.
// ─────────────────────────────────────────────────────────────

// Default max body size: 64KB
let _maxBodySize = 64 * 1024;

export function setMaxBodySize(bytes: number): void {
  _maxBodySize = Math.max(bytes, 1024); // Minimum 1KB
}

export function checkOversizedRequest(body: unknown): boolean {
  if (body === null || body === undefined) return false;

  try {
    const jsonStr = JSON.stringify(body);
    return jsonStr.length > _maxBodySize;
  } catch {
    // Can't serialize → treat as oversized/suspicious
    return true;
  }
}

export function checkMalformedIngress(body: unknown): { malformed: boolean; reason?: string } {
  if (body === null || body === undefined) {
    return { malformed: true, reason: "Body is null or undefined" };
  }

  if (typeof body !== "object") {
    return { malformed: true, reason: "Body must be a JSON object" };
  }

  // Check for basic shape: must have session object
  const bodyObj = body as Record<string, unknown>;
  if (!bodyObj.session || typeof bodyObj.session !== "object") {
    return { malformed: true, reason: "Missing or invalid session object" };
  }

  const session = bodyObj.session as Record<string, unknown>;
  if (!session.session_id || typeof session.session_id !== "string" || session.session_id.length === 0) {
    return { malformed: true, reason: "Missing session.session_id" };
  }

  // Request object must exist (can be empty-ish but must be present)
  if (!bodyObj.request || typeof bodyObj.request !== "object") {
    return { malformed: true, reason: "Missing request object" };
  }

  return { malformed: false };
}

export function checkSuspiciousPatterns(body: unknown): { suspicious: boolean; reason?: string } {
  if (typeof body !== "object" || body === null) {
    return { suspicious: true, reason: "Non-object body" };
  }

  const bodyObj = body as Record<string, unknown>;

  // Check for excessive nesting depth
  const depth = getNestingDepth(bodyObj);
  if (depth > 10) {
    return { suspicious: true, reason: `Excessive nesting depth: ${depth}` };
  }

  // Check for excessive key count
  const keyCount = countKeys(bodyObj);
  if (keyCount > 100) {
    return { suspicious: true, reason: `Excessive key count: ${keyCount}` };
  }

  return { suspicious: false };
}

function getNestingDepth(obj: Record<string, unknown>, depth: number = 0): number {
  let maxDepth = depth;
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const childDepth = getNestingDepth(value as Record<string, unknown>, depth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }
  }
  return maxDepth;
}

function countKeys(obj: Record<string, unknown>): number {
  let count = Object.keys(obj).length;
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      count += countKeys(value as Record<string, unknown>);
    }
  }
  return count;
}
