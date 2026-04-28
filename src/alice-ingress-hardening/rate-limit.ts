// ─────────────────────────────────────────────────────────────
// ALICE INGRESS HARDENING PACK v1.0 — Rate Limit Hooks
//
// Bounded v1 in-memory rate limiting:
// - per-session / per-user / per-fingerprint throttle
// - simple bounded rule
//
// No full infra-level rate limiting, but already with ingress abuse guard.
// ─────────────────────────────────────────────────────────────

// In-memory rate counters (bounded)
const _rateCounters: Map<string, { count: number; resetAt: number }> = new Map();

// Default: 60 requests per 60 seconds per key
let _maxRequests = 60;
let _windowMs = 60 * 1000;

export function setRateLimitConfig(maxRequests: number, windowMs: number): void {
  _maxRequests = Math.max(maxRequests, 1);
  _windowMs = Math.max(windowMs, 1000);
}

export function checkIngressRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const existing = _rateCounters.get(key);

  if (!existing || now >= existing.resetAt) {
    // New window
    _rateCounters.set(key, { count: 1, resetAt: now + _windowMs });
    return { allowed: true, remaining: _maxRequests - 1 };
  }

  if (existing.count >= _maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  existing.count += 1;
  return { allowed: true, remaining: _maxRequests - existing.count };
}

export function resetRateLimit(key: string): void {
  _rateCounters.delete(key);
}

export function getRateLimitStats(key: string): { count: number; remaining: number; windowResetAt: number } | null {
  const existing = _rateCounters.get(key);
  if (!existing) return null;
  return {
    count: existing.count,
    remaining: Math.max(0, _maxRequests - existing.count),
    windowResetAt: existing.resetAt,
  };
}

export function cleanExpiredRateCounters(): void {
  const now = Date.now();
  for (const [key, counter] of _rateCounters) {
    if (now >= counter.resetAt) {
      _rateCounters.delete(key);
    }
  }
}
