# TeleGPT — TGP-17D Provider Selection Orchestrator — Verification

**Status:** LOCKED
**Parent:** TGP-17C (Capability Registry) — `8292c75`
**Date:** 2026-07-19
**Scope:** Single canonical provider-selection authority for ALL routable requests,
including explicit provider-prefixed routes. Replaces ad-hoc per-branch logic
with a unified capability → health → scoring → fallback pipeline.

---

## 1. Objective

TGP-17A/B/C built the three decision layers:

```
Capability Registry (17C) → Health Runtime (17A) → Scoring Engine (17B)
```

TGP-17D binds them into one immutable **ProviderSelectionPlan** that the Router
consumes for every route — `auto`, `kimi:`, `zyloo:`, `local:`, etc. — so that
**explicit route ≠ bypass policy**.

---

## 2. Canonical Pipeline

```
Request intent (model string + meta)
       ↓
parseRouteIntent() → ProviderRouteIntent { mode, requestedProviderId, requiredCapabilities }
       ↓
buildProviderCandidates() → Candidate[] (canonical order, deduped)
       ↓
CapabilityRegistry.resolve() → capabilityEligible, capabilityRejected[missing_capability]
       ↓
HealthRuntime (snapshot) → eligible, healthRejected[provider_unavailable|circuit_open|cooldown_active]
       ↓
ScoringEngine.rankProviders() → rankedProviders[]
       ↓
Preference precedence (requested first if capable+eligible) → selectedProviderId
       ↓
fallbackOrder = rankedProviders \ {selected} (if allowFallback)
       ↓
ProviderSelectionPlan (immutable, sanitized)
```

**Fail-open** at every layer — errors degrade to wider candidate sets rather than blocking.

---

## 3. Route Intent Contract (`src/core/provider-selection-orchestrator.ts`)

```typescript
type RouteMode = "auto" | "preferred_provider" | "required_provider";

interface ProviderRouteIntent {
  mode: RouteMode;
  requestedProviderId?: ProviderId;
  requestedProviderFamily?: string;
  requestedModel?: string;
  allowFallback: boolean;
  requiredCapabilities: Capability[];
  source: "auto" | "model_prefix" | "request_metadata" | "runtime_policy";
}
```

### Semantics

| Mode | Selection | Fallback | Error if incapable/ineligible |
|------|-----------|----------|-------------------------------|
| `auto` | Best ranked eligible | Full chain | `NO_ELIGIBLE_PROVIDER` (503) |
| `preferred_provider` | Requested first if capable+eligible; else ranked fallback | Allowed | Sanitized error for requested; fallback continues |
| `required_provider` | Only requested | Disallowed by default (opt-in via `allowFallback`) | `REQUIRED_PROVIDER_UNAVAILABLE` (503) / `REQUIRED_PROVIDER_UNKNOWN` (400) |

**Compatibility**: Existing prefixes (`kimi:`, `zyloo:`, `openai:`, etc.) map to
`preferred_provider` — preserving current UX while adding capability/health gating.

---

## 4. Candidate Construction

`buildProviderCandidates(intent, registry)`:

- `auto` → all registered providers in **CANONICAL_PROVIDER_ORDER** (deduped).
- `preferred_provider` → requested first, then canonical order (deduped).
- `required_provider` → single-element array `[requested]`.

Unknown providers → `preferred_provider` with `requestedProviderId="local"` (fail-open,
preserves existing "unknown prefix → local" behavior).

---

## 5. Unified Selection Plan (`ProviderSelectionPlan`)

```typescript
interface ProviderSelectionPlan {
  requestId?: string;
  intent: ProviderRouteIntent;
  requiredCapabilities: Capability[];
  consideredProviders: ProviderId[];
  capabilityRejected: { providerId; reason: "missing_capability" }[];
  healthRejected: { providerId; reason: "provider_unavailable"|"circuit_open"|"cooldown_active" }[];
  eligibleProviders: ProviderId[];
  rankedProviders: { providerId; score }[];
  selectedProviderId?: ProviderId;
  selectedModel?: string;
  fallbackOrder: ProviderId[];
  terminalReason?: string;
  timestamp: number;
}
```

Every rejection carries a **sanitized reason code** — no raw errors, no secrets.

---

## 6. Scoring Preference (TGP-17D.6)

- **Scoring engine is NEVER modified by prefix**.
- Preference is an **orchestration-level tie-breaker**:
  - If requested provider is in `eligibleProviders`, it is moved to front of
    `rankedProviders` before selecting.
  - Otherwise normal ranked order applies.

Documented in code: `planProviderSelectionV2` preference precedence block.

---

## 7. Fallback Plan Integration (TGP-17D.7)

`executeWithOrchestrator` (in `router.ts`):

1. Builds `ProviderSelectionPlan`.
2. Iterates `attemptOrder = [selectedProviderId, ...fallbackOrder]`.
3. Calls `executeProvider(providerId, model, req)` for each.
4. On failure with `failureType` + `shouldFallback=false` → terminal (ProviderFailurePolicy).
5. On other failures → continue to next in `fallbackOrder`.
6. Exhausted → `SELECTION_PLAN_EXHAUSTED` (503) with full rejection context.

**Credential cycling** stays inside provider (Zyloo dual-key) — does not alter
orchestrator fallback order.

---

## 8. Auto Router Migration (TGP-17D.8)

`auto` route now:

1. `deriveRequiredCapabilities(req)` → caps from `tools`, `task.type`, `meta.long_context`, `meta.capabilities`.
2. `planProviderSelection(candidatePool, caps)` → capability-eligible set.
3. Passes `capableCandidates` to `autoRoute(..., { candidateProviders })`.
4. Auto Router v2 selects intent; orchestrator plan metadata attached to `req.meta`.

Backward-compatible: `auto` output unchanged; `intent` / `capability_*` fields added to evidence.

---

## 9. Evidence Events (TGP-17D.9)

Sanitized events emitted via `execution-evidence-store`:

| Type | When | Key Fields |
|------|------|------------|
| `provider.selection.planned` | After plan built | `routeMode`, `requestedProviderId`, `requiredCapabilities`, `consideredProviderIds`, `selectedProviderId`, `fallbackOrder`, `rejectionReasonCodes` |
| `provider.selection.selected` | On first successful execution | Same + `selectedProviderId` confirmed |
| `provider.selection.rejected` | Each provider rejected in fallback | `providerId`, `rejectionReasonCode`, `failureType` |
| `provider.selection.exhausted` | All fallbacks exhausted | Full plan context + `lastError` |

**Never includes**: credentials, raw errors, prompts, response bodies, auth headers, internal URLs.

---

## 10. Diagnostics Endpoint (TGP-17D.10)

`GET /internal/provider-selection` (auth: `gatewayAuthMiddleware`)

Query params:
- `model` — e.g. `kimi:kimi-k3`, `auto`, `zyloo:zyloo/kimi-k3`
- `strict=true|false` — force `required_provider`
- `noFallback=true|false` — disable fallback
- `capabilities[]` — e.g. `reasoning,vision`

Returns dry-run `ProviderSelectionPlan` — **no execution**, **no upstream calls**,
deterministic, sanitized.

---

## 11. Error Taxonomy & HTTP Mapping (TGP-17D.11)

| Code | HTTP | Meaning |
|------|------|---------|
| `REQUIRED_PROVIDER_UNKNOWN` | 400 | Strict route to unregistered provider |
| `NO_CAPABLE_PROVIDER` | 503 | No provider satisfies required capabilities |
| `NO_ELIGIBLE_PROVIDER` | 503 | Capable providers exist but all unhealthy/circuit-open |
| `REQUIRED_PROVIDER_UNAVAILABLE` | 503 | Strict provider incapable or ineligible |
| `SELECTION_PLAN_EXHAUSTED` | 503 | All fallbacks failed |

**No HTTP 500 for expected selection outcomes.** Mapping used in `router.ts`
catch blocks.

---

## 12. Test Evidence

| Suite | Tests | Result |
|-------|-------|--------|
| `providerSelectionOrchestrator.test.ts` | 29 | PASS |
| `providerCapabilityRegistry.test.ts` | 18 | PASS |
| `providerHealthDiagnostics.test.ts` (incl. selection endpoint) | 11 | PASS |
| `kimiK3Router.test.ts` | 37 | PASS |
| `modelRouter.test.ts` | 17 | PASS |
| `lanes.test.ts` | 16 | PASS |
| `providerRegistry.test.ts` | 15 | PASS |
| `zylooApi.test.ts` | 27 | PASS |
| `zylooQuotaFailover.test.ts` | 12 | PASS |
| `providerFailurePolicy.test.ts` | 30 | PASS |
| `zylooFallbackE2E.test.ts` | 10 | PASS |
| `gateway.test.ts` | 20 | PASS |
| `gatewayStartup.test.ts` | 5 | PASS |
| **TGP-17D total** | **40 new** | **PASS** |
| **Full regression** | **312** | **PASS** |

Key assertions covered:
- Auto / preferred / required / unknown prefix parsing
- Candidate ordering + deduping
- Preferred capable+healthy → selected
- Preferred incapable → fallback
- Preferred unavailable/circuit-open → fallback
- Strict incapable/unavailable → terminal 503/400
- Strict with fallback enabled → still pins
- Required unknown → 400
- Auto unchanged
- Capability / health rejection recorded
- Deterministic plan
- Fallback order excludes selected
- Sanitized JSON (no `sk-`, `Bearer`)
- HTTP mapping ≠ 500
- Selection endpoint dry-run

---

## 13. Security & Sanitization

- `ProviderSelectionPlan` JSON verified free of `sk-`, `Bearer`, `API key`.
- Diagnostics endpoint authenticated, read-only, no upstream calls.
- Evidence payloads sanitized.
- Orchestrator never inspects raw provider errors — only `failureType` from
  `ProviderFailurePolicy`.

---

## 14. Lock Statement

TGP-17D is complete and verified:

- ✅ Single canonical provider-selection authority (`planProviderSelectionV2`).
- ✅ All explicit routes (`kimi:`, `zyloo:`, `openai:`, `deepseek:`, `qwen:`, `local:`) flow through orchestrator.
- ✅ Capability, health, circuit, cooldown, eligibility checks apply to every route.
- ✅ Preferred vs required semantics explicit, tested, documented.
- ✅ Scoring engine untainted by prefix policy.
- ✅ Execution consumes one immutable `fallbackOrder`.
- ✅ Auto route backward-compatible.
- ✅ Expected selection failures → sanitized HTTP (400/503), never 500.
- ✅ Diagnostics authenticated, deterministic, dry-run.
- ✅ 312/312 tests pass (40 new + 272 regression).

**Adaptive Provider Runtime v1.3 — LOCKED** (TGP-17A `a0a593b` + 17B `cb2fefe` + 17C `8292c75` + 17D this commit).

---

## 15. Explicitly Deferred (Out of Scope)

- Quality scoring / learned preferences
- Token-budget optimization
- Live price / cost calculation
- Parallel provider racing / speculative execution
- Distributed orchestration state
- Database persistence of plans
- Semantic prompt classification beyond current capability derivation
- Quality Runtime, Budget Runtime, Racing Runtime — all build on this layer.