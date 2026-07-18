# TGP-17A — Provider Health Runtime

**Status:** LOCKED
**Depends on:** TGP-14 → TGP-16B (LOCKED)
**Test suite:** 179/179 PASS

---

## Purpose

Implement the canonical dynamic health layer for Tele•GPT providers. Provider-agnostic. Observes execution outcomes via ProviderFailurePolicy. Does NOT score or rank providers (deferred to TGP-17B).

---

## Contracts

### ProviderHealthStatus

```typescript
type ProviderHealthStatus = "unknown" | "healthy" | "degraded" | "unavailable";
```

### ProviderHealthSnapshot

```typescript
interface ProviderHealthSnapshot {
  providerId: string;
  status: ProviderHealthStatus;
  circuitState: CircuitState;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  availabilityRate: number;
  rollingFailureRate: number;
  averageLatencyMs: number;
  latencyP95Ms: number;
  lastLatencyMs: number;
  lastAttemptAt: number;
  lastSuccessAt: number;
  lastFailureAt: number;
  lastFailureType: ProviderFailureType | null;
  cooldownUntil: number;
  updatedAt: number;
}
```

---

## State Machine

```
unknown ──success──→ healthy
healthy ──2 failures──→ degraded
degraded ──5 failures──→ unavailable
degraded ──3 successes──→ healthy
unavailable ──half-open circuit──→ degraded
open circuit ──→ unavailable (override)
half-open circuit ──→ degraded (override)
```

---

## Transition Thresholds

| Constant | Value | Purpose |
|----------|-------|---------|
| DEGRADATION_THRESHOLD | 2 | consecutive failures to degrade |
| UNAVAILABLE_THRESHOLD | 5 | consecutive failures to go unavailable |
| RECOVERY_SUCCESS_THRESHOLD | 3 | consecutive successes to recover from degraded |
| ROLLING_WINDOW_SIZE | 50 | bounded outcome samples |
| LATENCY_SAMPLE_WINDOW | 30 | bounded latency samples |
| CIRCUIT_FAILURE_THRESHOLD | 3 | matches existing circuit breaker |
| CIRCUIT_WINDOW_MS | 60,000 | matches existing circuit breaker |
| CIRCUIT_COOLDOWN_MS | 300,000 | matches existing circuit breaker |

---

## Metric Semantics

- **availabilityRate**: rolling window (last 50 outcomes), not lifetime
- **rollingFailureRate**: rolling window (last 50 outcomes), not lifetime
- **averageLatencyMs**: rolling window (last 30 samples), not lifetime
- **latencyP95Ms**: rolling window (last 30 samples), sorted, 95th percentile
- **totalRequests**: lifetime counter, incremented by recordSuccess/recordFailure
- **attempt counting**: every real upstream request = 1 attempt; recordAttempt only sets timestamp

---

## Circuit-Breaker Relationship

- Health Runtime uses its own CircuitBreaker instances (per-provider)
- Circuit states: closed, half-open, open
- open circuit → status forced to unavailable
- half-open circuit → status forced to degraded
- Health Runtime does NOT independently open/close the existing ProviderFailurePolicy breaker
- Both breakers use identical configuration (3 failures / 60s window / 5min cooldown)

---

## Attempt-Counting Semantics

- `recordAttempt(providerId, timestamp)` — records timestamp only, does NOT increment totalRequests
- `recordSuccess(providerId, latencyMs, timestamp)` — increments totalRequests, records success
- `recordFailure(providerId, decision, latencyMs, timestamp)` — increments totalRequests, records failure
- One logical Gateway request may generate several provider attempts (credential cycling, fallback)
- Each upstream request counts as exactly 1 provider attempt

---

## Observability Contract

### Evidence Events

- `provider.health.transitioned` — emitted on status change
- Required fields: providerId, previousStatus, currentStatus, circuitState, failureType, latencyMs, consecutiveFailures, consecutiveSuccesses, availabilityRate, rollingFailureRate
- Never includes: credentials, authorization headers, raw upstream messages, prompts, generated content

### Diagnostics Endpoint

```
GET /internal/provider-health
Authorization: Bearer tgpt_sk_...
```

- Protected by gateway authentication
- Read-only
- Returns sanitized snapshots
- Does not alter OpenAI-compatible public response contracts

---

## Security Rules

- Health snapshots never contain API keys, raw credentials, billing messages, prompts, or response bodies
- Diagnostics endpoint requires authentication
- No raw provider error messages in health state

---

## Test Evidence

| Test Suite | Tests | Status |
|-----------|-------|--------|
| providerHealthRuntime.test.ts | 34 | ✅ PASS |
| providerHealthDiagnostics.test.ts | 4 | ✅ PASS |
| zylooApi.test.ts | 27 | ✅ PASS |
| zylooQuotaFailover.test.ts | 12 | ✅ PASS |
| providerFailurePolicy.test.ts | 30 | ✅ PASS |
| zylooFallbackE2E.test.ts | 10 | ✅ PASS |
| kimiK3Router.test.ts | 37 | ✅ PASS |
| gateway.test.ts | 20 | ✅ PASS |
| gatewayStartup.test.ts | 5 | ✅ PASS |
| **Total** | **179** | **✅ ALL PASS** |

---

## Explicitly Deferred to TGP-17B

- Weighted scoring
- Quality ranking
- Price calculation
- Token-budget routing
- Capability matching
- Learned preferences
- Parallel provider racing
- Database persistence
- Distributed health synchronization

---

## Files

| File | Purpose |
|------|---------|
| `src/core/provider-health-runtime.ts` | Health contracts, registry, state machine, metrics |
| `src/core/router.ts` | Wired health recording for Zyloo handler |
| `src/gateway/index.ts` | Added `/internal/provider-health` endpoint |
| `src/runtime/evidence/execution-evidence.types.ts` | Added health evidence types |
| `tests/unit/provider/providerHealthRuntime.test.ts` | 34 comprehensive tests |
| `tests/unit/gateway/providerHealthDiagnostics.test.ts` | 4 diagnostics endpoint tests |
