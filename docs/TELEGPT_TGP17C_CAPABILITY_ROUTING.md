# TeleGPT — TGP-17C Capability Registry & Capability-Based Routing — Verification

**Status:** LOCKED
**Parent:** TGP-17B (Provider Scoring Engine) — `cb2fefe`
**Date:** 2026-07-19
**Scope:** Fourth layer of the Adaptive Provider Runtime (v1.2) — declarative capability
pre-filtering that narrows provider candidates BEFORE the Health → Scoring → Execution chain.

---

## 1. Objective

TGP-17B lets the Router answer *"which available provider is currently best?"*.
TGP-17C adds the missing question: *"which providers can even fulfill this request?"*.

The request becomes declarative — it states WHAT it needs (reasoning, json, tools,
vision, long_context, …) and the Capability Registry decides WHO is eligible. This
is a pure pre-filter that runs before Health Runtime, Eligibility, and Scoring, and
never mutates their state.

---

## 2. Architecture

```
User Request (needs: reasoning, json, tools, ...)
        ↓
Capability Resolver  ── reads Capability Registry
        ↓  capable candidates (capability-filtered)
Health Runtime → Eligibility → Scoring Engine → Execution → Failure Policy → Evidence
```

Nothing downstream is broken: capability filtering only narrows the candidate set.
If the capability layer fails, it degrades to "all candidates pass" (fail-open).

---

## 3. Capability Model

Atomic capabilities (`src/core/provider-capability-registry.ts`):

```
reasoning | tools | vision | json | code | long_context | video | audio |
image | streaming | function_calling
```

Each provider advertises a `CapabilityLevel` per capability: `none | basic | standard | advanced`.
Level is used for future tie-breaking; exclusion is binary (any non-`none` level satisfies a requirement).

`CapabilityRegistry` is the declarative knowledge layer. It ships a `DEFAULT_CAPABILITY_MATRIX`
covering every `ProviderId` in `provider-resolution.ts`, with realistic profiles:
- `openai_api`: full surface (reasoning/video/vision/json/tools/function_calling…)
- `deepseek_api`: reasoning + code, no vision
- `kimi_api` / `zyloo_api`: long_context + reasoning
- `local`: basic reasoning/json/code only
- web-bridge providers: limited (basic) capability surface

---

## 4. API Surface

| Export | Purpose |
|--------|---------|
| `CapabilityRegistry` | Registry with `getProfile`, `hasCapability`, `levelOf`, `setProfile`, `reset`, `listProviders`, `resolve`. |
| `DEFAULT_CAPABILITY_MATRIX` | Frozen default per-provider capability profiles. |
| `capabilityRegistry` | Shared singleton used by Router + diagnostics. |
| `filterCapableProviders(candidates, required, registry?)` | Convenience pre-filter; fail-open. |
| `planProviderSelection(candidates, required, registry?)` | Full chain: capability → health eligibility → scoring ranking → selected. Returns `ProviderSelectionPlan`. |
| `deriveRequiredCapabilities(req)` (in router.ts) | Derives required caps from `req.tools`, `req.task.type`, `meta.long_context`, `meta.capabilities`. |

`resolve(candidates, required)` semantics:
- AND semantics — a provider must satisfy ALL required capabilities.
- Unknown provider (not in registry) → treated as capable (fail-open).
- Returns `{ eligible, excluded: [{providerId, missing}], required, timestamp }`.

---

## 5. Router Integration (TGP-17C)

`src/core/router.ts` `auto` route now:
1. Derives required capabilities from the request (tools → tools+function_calling; task.type → reasoning/code/vision; meta.long_context → long_context; meta.capabilities → explicit list).
2. Calls `planProviderSelection(candidatePool, requiredCaps)` to get the capability-eligible set.
3. Passes `capableCandidates` into Auto Router v2's `autoRoute` as `candidateProviders`, so intent selection only picks among capable providers.
4. Emits `tgp17c:capability_filter` log and records `capability_required` / `capability_excluded` / `capability_eligible` into `req.meta` for evidence.
5. Capability resolution is fully non-fatal: any error degrades to the full candidate pool.

Gateway: `GET /internal/provider-capabilities` (auth-protected) returns the full
capability matrix + `ALL_CAPABILITIES` list for operators.

---

## 6. Test Evidence

| Suite | Tests | Result |
|-------|-------|--------|
| `tests/unit/provider/providerCapabilityRegistry.test.ts` | 18 | PASS |
| `tests/unit/gateway/providerHealthDiagnostics.test.ts` (capabilities endpoint) | 8 (incl. 2 new) | PASS |
| **TGP-17C total** | **20** | **PASS** |

Regression (full suite): **243/243 PASS** (227 TGP-17A/17B baseline + 16 new).

Key assertions:
- Default matrix covers all `ProviderId`s.
- `hasCapability` / `levelOf` correct (deepseek lacks vision; kimi has advanced long_context).
- `resolve` excludes incapable providers with accurate `missing` list.
- AND semantics: requires ALL caps.
- Fail-open for unknown providers and on resolution error.
- Runtime `setProfile` override adds capability; `reset` restores defaults.
- `planProviderSelection` excludes incapable from ranking, ranks capable by health+scoring, degrades when all unhealthy, deterministic.
- Capability diagnostics JSON contains no `sk-` / `Bearer`.
- Gateway `/internal/provider-capabilities` returns 200 with correct matrix.

---

## 7. Security & Sanitization

- Capability matrix contains no keys, tokens, or raw errors.
- All diagnostics outputs verified free of credential/auth markers.
- Router capability resolution is wrapped in fail-open guards — never blocks routing.

---

## 8. Lock Statement

TGP-17C is complete and verified:
- Declarative capability matrix + registry implemented.
- Capability pre-filter wired into Router `auto` path (non-fatal, fail-open).
- Full `planProviderSelection` chains capability → health → scoring.
- Gateway `/internal/provider-capabilities` diagnostics endpoint added.
- 20 new tests green; full suite 243/243 green.
- No regression to TGP-17A/17B, TGP-16, TGP-15A, or TGP-14.

**Adaptive Provider Runtime v1.2 — LOCKED** (TGP-17A `a0a593b` + TGP-17B `cb2fefe` + TGP-17C this commit).

Subsequent work (Learning/Quality/Budget Runtime, Provider Racing) should consume the
capability layer as the front filter rather than re-implementing provider selection.
