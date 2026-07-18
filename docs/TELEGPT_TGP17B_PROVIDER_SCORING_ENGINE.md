# TeleGPT — TGP-17B Provider Scoring Engine — Verification

**Status:** LOCKED
**Parent:** TGP-17A (Provider Health Runtime) — `a0a593b`
**Date:** 2026-07-19
**Scope:** Deterministic, explainable provider scoring and ranking layered on top of the Provider Health Runtime (TGP-17A).

---

## 1. Objective

TGP-17A produces live health state per provider. TGP-17B consumes that state to
produce a **weighted composite score** per provider and a **ranked ordering** so
the Router can prefer the best provider and exclude unhealthy ones.

Design constraints (from anchored plan):
- Deterministic — no randomness, same inputs → same ranking.
- Explainable — every score ships a full weighted breakdown.
- Read-only consumer of the Health Runtime — does NOT mutate health state, does NOT revive excluded providers.
- Sanitized — no keys, tokens, or raw error text escape in diagnostics.

---

## 2. Weighted Scoring Model

Composite score `S ∈ [0,1]`:

```
S = w_av  * availabilityNorm
  + w_lat * latencyNorm
  + w_fr  * failureRateNorm
  + w_pri * priorityNorm
  + w_cost* costNorm
```

Default weights (sum to 1.0):

| Dimension       | Weight | Source                                            |
|-----------------|--------|---------------------------------------------------|
| Availability    | 0.35   | Health Runtime `availabilityRate`                 |
| Latency         | 0.25   | Health Runtime `averageLatencyMs` (lower better)  |
| Failure rate    | 0.20   | Health Runtime `rollingFailureRate` (lower better)|
| Priority        | 0.10   | Per-provider policy `priority` (1–10)             |
| Cost            | 0.10   | Per-provider policy `costClass` (free→premium)    |

**Normalizers**
- `availabilityNorm` = `availabilityRate` (already 0..1).
- `latencyNorm` = `clamp(1 - (avgLatencyMs / LATENCY_BUDGET_MS), 0, 1)`, `LATENCY_BUDGET_MS = 5000`.
- `failureRateNorm` = `1 - rollingFailureRate`.
- `priorityNorm` = `clamp(priority / 10, 0, 1)`.
- `costNorm` = `{ free: 1.0, cheap: 0.75, standard: 0.5, premium: 0.25 }`.

**Eligibility**
- Provider with health status `unavailable` → `eligible = false`, excluded from ranking (ranking position omitted).
- `degraded` providers remain eligible but score lower (availability penalty applied).
- Circuit `OPEN` → treated as `unavailable` for ranking purposes.

---

## 3. API Surface (`src/core/provider-scoring-engine.ts`)

| Export | Purpose |
|--------|---------|
| `scoreProvider(id)` | Returns `{ providerId, score, eligible, healthStatus, breakdown, reasons? }`. |
| `rankProviders(ids?, config?)` | Ranks all registered (or provided) providers; excludes ineligible. |
| `selectBestProvider(ids?)` | Returns top-ranked `RankedProvider` or `null` if none eligible. |
| `getRankingDiagnostics()` | Full sanitized ranking snapshot `{ ranked, totalEligible, totalExcluded, totalRegistered, timestamp }`. |
| `recordScoringOutcome(id, success, latencyMs, failure?)` | Lightweight hook called by Router after each execution; reconciles with Health Runtime. |
| `setScoringConfig(partial)` / `getScoringConfig()` / `resetScoringConfig()` | Runtime weight tuning. |
| `setProviderPolicies(map)` / `resetProviderPolicies()` | Per-provider `priority` + `costClass`. |
| `DEFAULT_SCORING_CONFIG` | Frozen default weights. |

---

## 4. Router Integration (TGP-17B)

`src/core/router.ts` Zyloo path now:
- On success: calls `healthRecordSuccess` **and** `recordScoringOutcome(id, true, latencyMs, null)`.
- On failure: calls `healthRecordFailure` **and** `recordScoringOutcome(id, false, latencyMs, decision)`.
- Scoring is a **non-fatal** side-channel — any error in scoring is swallowed so routing is never blocked by the scoring engine.
- Ranking is exposed to operators via `GET /internal/provider-ranking` (Gateway, TGP-17A+17B).

The `auto` route continues to use Auto Router v2 for intent selection; the Scoring
Engine provides the health- and cost-aware tie-breaker / observability layer.

---

## 5. Test Evidence

| Suite | Tests | Result |
|-------|-------|--------|
| `tests/unit/provider/providerScoringEngine.test.ts` | 23 | PASS |
| `tests/unit/ateway/providerHealthDiagnostics.test.ts` (ranking endpoint) | 6 | PASS |
| `tests/unit/router/scoringEngine.test.ts` | 5 | PASS |
| **TGP-17B total** | **34** | **PASS** |

Regression (full suite): **227/227 PASS** (179 TGP-17A baseline + 48 new).

### Key assertions covered
- Score ∈ (0,1] for healthy; `eligible=false` for unavailable.
- Breakdown components sum exactly to composite score (ε < 1e-4).
- Default weights sum to 1.0.
- Identical inputs → identical ranking (determinism).
- Ties broken by `providerId` for stability.
- Higher availability weight favors high-availability provider.
- Higher latency weight penalizes slow provider.
- Degraded scores lower than healthy; unavailable excluded.
- Availability, failure-rate, priority, cost dimensions each influence score correctly.
- Ranking positions assigned 1..N; `maxResults` caps output.
- `selectBestProvider` returns highest-score; `null` when all excluded.
- Diagnostics JSON contains no `sk-`, `Bearer`, or `API key` text (sanitized).

---

## 6. Gateway Endpoint

`GET /internal/provider-ranking` (auth-protected via `gatewayAuthMiddleware`):
- Returns `{ ranked, totalEligible, totalExcluded, totalRegistered, timestamp }`.
- Ranked entries include `rankingPosition`, `score`, `healthStatus`, `eligible`, and `breakdown`.

---

## 7. Security & Sanitization

- Scoring engine never receives raw API keys or error messages; it consumes only
  normalized health metrics and policy config.
- `getRankingDiagnostics()` output is verified free of credential/auth markers.
- Router scoring calls are wrapped in try/catch — scoring failures never surface to clients.

---

## 8. Lock Statement

TGP-17B is complete and verified:
- Weighted, deterministic, explainable scoring engine implemented.
- Router wired (non-fatal side-channel) for Zyloo execution outcomes.
- Gateway diagnostics endpoint `/internal/provider-ranking` added.
- 34 new tests green; full suite 227/227 green.
- No regression to TGP-17A, TGP-16, TGP-15A, or TGP-14.

**Locked.** Subsequent provider-selection work should consume `selectBestProvider`
and the `/internal/provider-ranking` endpoint rather than re-implementing scoring.
