// src/server/middleware/rateLimit.ts
import type { FastifyReply, FastifyRequest } from "fastify";
import { getAuthContext } from "./auth.js";
import { DEFAULT_LIMITS } from "../../core/agent/runtime/runtimeLimits.js";

type Bucket = { tokens: number; lastRefillMs: number };
type Key = string;

const buckets = new Map<Key, Bucket>();
const activeStreams = new Map<string, number>(); // subject -> count

function now() { return Date.now(); }

function refill(bucket: Bucket, ratePerMin: number) {
  const perMs = ratePerMin / 60_000;
  const dt = now() - bucket.lastRefillMs;
  if (dt <= 0) return;
  bucket.tokens = Math.min(ratePerMin, bucket.tokens + dt * perMs);
  bucket.lastRefillMs = now();
}

function takeToken(key: Key, ratePerMin: number): boolean {
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: ratePerMin, lastRefillMs: now() };
    buckets.set(key, b);
  }
  refill(b, ratePerMin);
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

// Route keys for rate limiting
type RouteKey = "agent_run" | "agent_stream" | "agent_status" | "evidence_verify";

function getLimitPerMin(routeKey: RouteKey): number {
  switch (routeKey) {
    case "agent_run":
      return DEFAULT_LIMITS.rate.agentRunPerMin;
    case "agent_stream":
      return 60; // Burst-friendly for SSE
    case "agent_status":
      return DEFAULT_LIMITS.rate.statusPerMin;
    case "evidence_verify":
      return DEFAULT_LIMITS.rate.verifyPerMin;
    default:
      return 60;
  }
}

/**
 * Rate limit middleware factory
 * @param routeKey - Route key for rate limiting
 */
export function rateLimit(routeKey: RouteKey) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = getAuthContext(req);
    const subject = auth.subject;

    // For SSE endpoints, check active streams limit
    if (routeKey === "agent_stream") {
      const cur = activeStreams.get(subject) ?? 0;
      if (cur >= DEFAULT_LIMITS.rate.maxActiveStreams) {
        return reply.code(429).send({
          ok: false,
          error: { code: "RATE_LIMIT", message: "Too many active streams for subject" },
        });
      }
      // Increment will be done by rateLimitStreamAcquire
      return;
    }

    const limitPerMin = getLimitPerMin(routeKey);
    const key = `${subject}::${routeKey}`;
    const ok = takeToken(key, limitPerMin);

    if (!ok) {
      return reply.code(429).send({
        ok: false,
        error: { code: "RATE_LIMIT", message: "Too many requests" },
      });
    }
  };
}

/**
 * Acquire active stream slot for SSE
 * @param subject - Subject identifier
 */
export function rateLimitStreamAcquire(subject: string): boolean {
  const cur = activeStreams.get(subject) ?? 0;
  if (cur >= DEFAULT_LIMITS.rate.maxActiveStreams) {
    return false;
  }
  activeStreams.set(subject, cur + 1);
  return true;
}

/**
 * Release active stream slot for SSE
 * @param subject - Subject identifier
 */
export function rateLimitStreamRelease(subject: string): void {
  const cur = activeStreams.get(subject) ?? 0;
  if (cur <= 1) activeStreams.delete(subject);
  else activeStreams.set(subject, cur - 1);
}
