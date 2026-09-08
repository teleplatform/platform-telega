# PD-W3/B4-D1 — Local Auto Recursion Fix

STATUS: IMPLEMENTED + LOCKED 🔒
DECISION: B4-D1 GREEN — READY FOR DOCS LOCK → ACCEPTED (GREEN → LOCK)
Branch: `integration/runtime-recovery-index` · Baseline: B4-C STOP / B4-D0 root cause audit → feature `506f644`
Feature commit: `506f644` (`fix(router): fail closed on recursive local auto route`)
Docs lock commit: this file.

---

## 1. Goal

Eliminate a proven pre-existing availability defect in the legacy `routeChat`
seam: `local:auto` caused unbounded self-recursion. The remediation is a
fail-closed guard, **not** a feature: `local:auto` as an automatic local model
selection function is NOT restored within PD-W3 and becomes a separate future
product capability.

## 2. Classification (LOCKED)

- **Availability / DoS-like** defect (deterministic offline resource
  exhaustion). NOT an auth bypass, NOT a privilege escalation, NOT an
  authorization defect. No confidential data exposure.
- Pre-existing: introduced by **`0243a9d`** (tgp-17d) which removed the old
  `callLocalAuto` leaf and left a self-loop; pre-dates B2 `115b1d0` and
  B4-B `7c30ff4` — NOT a regression of the PD-W3 lock stack.

## 3. Defect cycle (root cause)

```
routeChat("local:auto")
 → executeWithOrchestrator                 router.ts:283
 → selectProvider / parseRouteIntent       requestedModel="auto", prefix local,
                                           local registered + eligible (fail-open)
 → executeProvider("local","auto")         router.ts:319  (case "local")
 → routeWithProvider("local:auto")         [removed in 506f644]
 → routeChat  → … unbounded self-recursion
```

No depth guard; async promise-chain resource exhaustion; deterministic when
reachable. Reachable from: authenticated Gateway (empty allowlist ⇒ all models
accepted), anonymous `/v1/chat` (`server/index.ts`), and `/chat`. NOT reachable
from `p2_storage` default or Telegram (concrete default).

## 4. Remediation (LOCKED — fail closed)

Guard is terminal. `case "local": model === "auto"` now throws a sanitized,
non-retryable service-unavailable error instead of re-entering `routeChat`.

- Do NOT restore `callLocalAuto`.
- Do NOT activate dormant `localAutoProvider` / `localSafeCall` (future
  capability, outside PD-W3).
- Do NOT redesign Auto Router v2; its fan-in re-entry sites remain
  one-bounded against the terminal guard.
- No recursion counters, no reset hooks, no test-only production branches.

## 5. Error contract (LOCKED)

`LOCAL_AUTO_UNAVAILABLE` →

- `statusCode: 503` (Service Unavailable)
- **non-retryable** (`retryable: false` — retrying `local:auto` can never
  succeed; MUST NOT be presented as `retryable:true` retry-able upstream error)
- `failureType: "invalid_request"`, `shouldFallback: false` → terminal rethrow
  via the existing ProviderFailurePolicy path (`router.ts` catch) before any
  fallback loop iteration — no other provider transport is ever reached.
- `errorType: "server_error"`; sanitized message; `hint`; `diagnostics`
  (`requested_model`, `available_providers`, `disabled_providers`).
- HTTP boundary: Gateway auth path honors `err.statusCode` → 503 (unchanged).
  Anonymous `/v1/chat` legacy seam maps `LOCAL_AUTO_UNAVAILABLE` explicitly →
  503 + `x-error-code`, (this branch is part of the fix, see §7).

## 6. Source change

- `src/core/router.ts` — new `localAutoUnavailable()` helper; fail-closed
  branch replaces the recursive `routeWithProvider("local:auto")`.
- `src/server/index.ts` — `LOCAL_AUTO_UNAVAILABLE` special-cased on the
  anonymous `/v1/chat` seam (mirrors `NO_PROVIDER_CONFIGURED`) → 503,
  non-retryable body. **Justified deviation from "≈2 files"**: without it
  `normalizeError` coerced the guard to a false `502 TELEGPT_UPSTREAM +
  retryable:true`, which misleads clients into retrying a deterministic
  failure. This mapping is part of the fix, not scope creep.
- `tests/unit/router/local-auto-failclosed.test.ts` — regression proof.

## 7. Regression proof (4/4)

| # | Proof target | Result |
|---|---|---|
| 1 | `routeChat({model:"local:auto"})` rejects with `LOCAL_AUTO_UNAVAILABLE` / 503, NOT RangeError, NO hang (bounded time) | PASS |
| 2 | Guard error propagates unwrapped & terminal (no `SELECTION_PLAN_EXHAUSTED` wrapper; `diagnostics.requested_model` intact; no fallback attempted) | PASS |
| 3 | Positive control: concrete `local-demo` still succeeds on the same legacy seam | PASS |
| 4 | `model="auto"` on legacy seam with Auto Router v2 disabled (`setAutoRouterConfig({enabled:false})`) → single bounded re-entry (`auto` → `local:auto`) → same terminal guard, 503 | PASS |

> Secondary path note: `model="auto"` with **Auto Router enabled** is out of
> scope (router.ts:648/670 rely on the guard as terminal boundary; no Auto
> Router production change per B4-D1). The recursion source is eliminated in
> every Auto Router state.

## 8. Non-regression (LOCKED from B4-B / B2)

| Suite | Result |
|---|---|
| local-auto-failclosed (new) | 4/4 |
| modelRouter / lanes / kimiK3Router / scoringEngine / providerRegistry | 17 / 16 / 37 / 5 / 15 |
| provider-selection-orchestrator | 29/29 |
| gatewayDispatch | 7/7 (×3 stable) |
| gatewayProviderChat | 10/10 (×3 stable) |
| providerChat-runtime | 8/8 |
| dispatch-planner | 17/17 |
| safe-execution | 16/16 |
| full build (`tsc -p tsconfig.server.json`) | PASS (0 errors) |
| boot | `/health` 200, `/ready` 200 (isolated) |
| bounded `/v1/chat` probe (`local:auto`) | HTTP **503** `{"error":"LOCAL_AUTO_UNAVAILABLE",...}` in ~14ms; 3 repeat probes ≤6ms; `/ready` still 200 — no uncontrolled recursion |
| secret scan / `git diff --check` | clean |

**B2/B4-B unchanged:** `src/gateway/**`, `src/runtime/dispatch-vnext/**`,
capability-vnext, trusted-context, auth, authz, Provider OS, Availability,
Evidence schema, Telegram, Worker, Forge, `p2_storage`, demo slice, streaming
and tool contracts — zero semantic changes. The migrated `local:local-chat`
slice and the demo slice continue to bypass/use `routeChat` exactly as locked.

## 9. `execution_started` finding (LOCKED — NOT fixed here)

> `execution_started` finding = **Evidence Taxonomy Hygiene / NAMING-SEMANTIC
> COLLISION**, not fixed in B4-D1 and not a demonstrated double-execution
> defect.

- The same type string is emitted from two scopes: Gateway surface
  (`ide.gateway.*` trace, `chat-completions.ts`) and Dispatch lifecycle
  (run_id-scoped, `dispatch-execution.ts`).
- No consumer double-processes these records; no real regression.
- Registered as evidence-taxonomy hygiene backlog. **No B4-E gate.**

## 10. Local auto selection — future capability (LOCKED)

`local:auto` is NOT restored in PD-W3. Automatic local model selection is a
separate future product capability (needs a real selection leaf + explicit
feature audit), never a bugfix resurrecting `callLocalAuto`.

## 11. Commit policy (LOCKED)

Single feature commit `506f644` (3 files: `src/core/router.ts`,
`src/server/index.ts`, regression test) + this docs-lock. Push approved by
reviewer post-lock. No merge, no deploy, no tag in this batch. `node_modules`
and `screenshots/` are never staged.