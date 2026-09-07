# PD-W3/B4-B — Authenticated Local Provider Dispatch

STATUS: IMPLEMENTED + LOCKED 🔒
DECISION: B4-B GREEN — READY FOR REVIEW → ACCEPTED (GREEN → LOCK)
Branch: `integration/runtime-recovery-index` · Baseline: B4 audit READY → B4-A feature `91b0505` / lock `fc040b6`
Feature commit: `7c30ff4` (`feat(dispatch): migrate authenticated local chat to dispatch`)
Docs lock commit: this file.

---

## 1. Goal (from B4-B audit + governance ruling)

Migrate ONE real, non-demo, authenticated provider path from Gateway/`routeChat`
onto the canonical Dispatch vNext pipeline: verified Gateway API actor →
`TrustedExecutionContext` → Dispatch planning → Provider OS selection →
provider executor → canonical Dispatch evidence → existing OpenAI-compatible
response. `routeChat` is fully bypassed for this slice only.

Scope is deliberately narrow. Anonymous/public surfaces (S1/S5), the demo slice,
and every other local:* alias remain on their existing seams.

## 2. Locked slice (exact, closed)

**Model slice (exact): `local:local-chat`**

```
authenticated public api actor
→ gatewayAuthMiddleware (validateApiKey)
→ resolveGatewayActor → TrustedExecutionContext (api:<id>)
→ Dispatch vNext (capability provider_chat)
→ ProviderRouterV2 → local:llm
→ LocalChatExecutor (route provider_http)
→ canonical localChat transport leaf (src/providers/local/chat.ts)
→ canonical Dispatch evidence lifecycle
→ existing OpenAI-compatible response (toOpenAiResponse)
```

**NOT migated:** any other `local:*` alias. The gateway condition is the exact
model string `local:local-chat` (`isProviderChatModel`), never a blanket
`model.startsWith("local:")`. Additional aliases require new audit evidence of
semantic equivalence with `local:local-chat`.

## 3. Gateway branching (unchanged lanes + one new branch)

| Condition | Lane |
|---|---|
| demo (`isDemoModel`) | existing `dispatchDemoReply` — unchanged |
| **exact authenticated `local:local-chat`** | **`dispatchProviderChat` (Dispatch vNext)** |
| everything else | existing legacy `routeChat` — unchanged |

Migrated slice is served exclusively by Dispatch. It is never
`Gateway → routeChat → Dispatch` nor `Gateway → Dispatch → routeChat`.
`routeChat` call count = 0 for the migrated slice (evidence-proof in tests).

## 4. Trust / identity (LOCKED from B4-A)

Reuses B4-A exactly: `gateway.authentication.verified_api_key` →
`api:key_<epoch_ms>_<hex>` via `createTrustedExecutionContext`. NO new
TrustedSource, NO ChatRequest identity, NO raw token propagation, NO meta
identity, NO anonymous actor, NO `system:runtime` fallback. `core/auth` and
`core/authz` untouched.

## 5. Capability / route / binding (additive only)

```
CapabilityKind:   provider_chat     (added)
ActionRouteKind:  provider_http     (added)
Descriptor:       cap.provider_chat
Binding:          provider_chat → provider_http,
                  runtime_target: NONE,
                  requires_provider: true
```

- The existing generic `"model"` capability and its `provider_bridge` demo
  binding are semantically untouched — `resolveByCapabilityKind("model")` still
  resolves to the demo binding.
- No RuntimeTarget is created for provider availability. Provider availability
  remains Provider OS authority for this slice (plan `availability: null`).

## 6. Provider OS — canonical authority

Dispatch uses **`ProviderRouterV2.select`** as the single provider authority.
Expected decision for this slice: `local:llm` (RuntimeAccessMode `public`,
task `reasoning`, constraints `free`/`local_only`).

No routeChat selection, no auto-router-v2, no routerScoring, no
candidateProviders, no second provider selector, no provider scoring inside the
executor. The `ProviderDecision` flows into the plan and is preserved into
execution (`provider_result_ref = local:llm`) without re-derivation.

## 7. Executor

`LocalChatExecutor` (route `provider_http`) owns **transient transport
execution only**. It invokes the canonical localChat transport leaf and
preserves real provider/model/usage/output facts in the execution result.

It does NOT:
- select providers
- perform cross-provider fallback
- call routeChat
- mutate Provider OS
- grant authorization
- synthesize availability
- synthesize a completion on transport failure (failure is an honest `failed`
  outcome)

**Fallback ownership (LOCKED):** `LocalChatExecutor` does not synthesize
fallback. Any deterministic offline behavior comes from the canonical
`localChat` transport leaf itself (`src/providers/local/chat.ts` — the
`if (!base)` offline reply when `LOCAL_OPENAI_BASE_URL` is empty). Dispatch
preserves the leaf's published semantics and never hides a transport failure.

## 8. Response contract

Existing OpenAI-compatible semantics preserved unchanged: HTTP status, `id`,
requested-model attribution, `choices[0].message.content`, `finish_reason`,
`usage`, error mapping. `toOpenAiResponse` / `toOpenAiError` wire contract
unchanged; no public HTTP contract changes.

## 9. Evidence lifecycle

- Gateway keeps only surface events for the migrated slice:
  `ide.gateway.request.received-<id>` and `ide.gateway.model.resolved-<id>`
  (context_routed, executionLane `dispatch_vnext`, provider `local:llm`).
- Execution lifecycle has **exactly one canonical**
  `dispatch_started` / `execution_started` / `execution_finished`.
- **No** `ide.gateway.execution.*` completion/failure record for the migrated
  slice — no duplicate gateway execution lifecycle.
- No Evidence schema changes.

## 10. Commit policy (LOCKED)

Single feature commit `7c30ff4` + this docs-lock. Push approved by reviewer
post-lock. No merge, no deploy, no tag in this batch. `node_modules` and
`screenshots/` are never staged.

## 11. Acceptance (recorded GREEN)

| Suite | Result |
|---|---|
| providerChat-runtime | **8 passed / 0 skipped / 0 failed** (8/8) |
| gatewayProviderChat | 10/10 |
| gateway | 20/20 |
| gatewayDispatch | 7/7 |
| gatewayStartup | 5/5 |
| trusted-context | 10/10 |
| planner | 17/17 |
| safe-execution | 16/16 |
| forge | 7/7 |
| worker | 13/13 |
| dispatch-vnext e2e | PASS |
| authz | 137/137 |
| capability | 21/21 |
| availability | 9/9 |
| provider | 215/215 |
| full build (`tsc -p tsconfig.server.json`) | PASS (0 errors) |
| isolated boot | main `/health` 200, `/ready` 200; gateway `/health` 200 |
| live probe (`local:local-chat` on booted gateway) | 200, model attribution, canonical leaf output, `finish_reason: stop` |
| HTTP transport proof (controlled localhost fixture) | PASS (fixture content + usage preserved) |
| secret scan | clean |
| `node_modules` / `screenshots` staged | NO |

## 12. No-change guarantees (LOCKED)

Zero semantic changes to:

- `src/core/router.ts` (`routeChat`)
- `ChatRequest`
- Availability (`RuntimeTarget` / target semantics)
- `core/auth`, `core/authz`, permission profiles
- Forge, Worker
- Telegram/Kilo, Browser OS
- `p2_storage`
- streaming contract (`stream:true` → existing 400 `not_supported`)
- tool execution contract
- `server/index.ts`
- Evidence schema
- demo slice (`local-demo`)

## 13. Deferred (NOT part of this lock)

- **OpenAI / Qwen / Kimi migration: remain deferred (B4-C+).** Not touched here.
- Other `local:*` aliases — require new audit evidence of semantic equivalence.
- `bridge.internal` — remains BLOCKED per B4-A.