# PD-W3/B4-A — Trusted Execution Context Boundary

STATUS: IMPLEMENTED + LOCKED 🔒
DECISION: B4-A GREEN — READY FOR REVIEW → ACCEPTED (GREEN → LOCK)
Branch: `integration/runtime-recovery-index` · Baseline: B4 audit BLOCKED → READY → B4-A feature `91b0505`
Docs lock commit: this file.

---

## 1. Goal (from B4 audit + governance ruling)

Turn the B2 `TrustedExecutionContext` pattern into an explicit, enforceable
internal trust boundary that future **authenticated** routeChat consumers can
reuse — WITHOUT migrating routeChat and WITHOUT adding any identity to
`ChatRequest`.

The problem this batch resolves: *who has the right to bring a trusted identity
to Dispatch*. Trust is formed at the server boundary (verified gateway API key),
never from request payload/meta.

## 2. Governance rulings (LOCKED)

1. **Anonymous/public execution: KEEP LEGACY.** Do NOT invent `anonymous:*`,
   `user:anonymous`, `system:runtime` fallback, or any synthetic public identity.
   Anonymous/`web` surfaces (S1/S5) stay on `routeChat` as an intentional
   compatibility boundary.
2. **Trusted execution identity:** reuse the existing `TrustedExecutionContext`
   authority. NO parallel `DispatchTrustedContext` model.
3. **`ChatRequest`:** MUST remain identity-free. `meta` is NEVER a trust source.
4. **Retry ownership split:** Dispatch = cross-route orchestration; Provider OS =
   provider selection/fallback; executor = transient transport retry;
   Worker/Forge = domain recovery; Bridge = delivery/redelivery.

## 3. Trusted sources — closed set (source grammar)

| Source | Status |
|---|---|
| `gateway.authentication.verified_api_key` | ✅ TRUSTED (only source) |
| `bridge.internal` | ❌ DEFERRED — no proven server-controlled producer today |
| `worker.executor` | ❌ NOT ADDED |
| `telegram` | ❌ NOT ADDED |
| `system` / `internal` | ❌ NOT VALID SOURCES for execution identity |

**Source grammar today (canonical for the existing gateway key-id):**
`gateway.authentication.verified_api_key → api:key_<epoch_ms>_<hex>`

⚠️ **Architectural caveat (bind to lock):** `api:key_<epoch_ms>_<hex>` is the
canonical grammar for the *current* gateway key-id format. It MUST NOT be treated
as the universal shape of all `api:` actors. A future verified API identity
format must be introduced through a **separate source-grammar extension** at the
boundary — never by bypassing construction control or loosening the regex.

## 4. Enforcement surface

- `src/core/trusted-context/` — canonical closed contract (types + factory).
- Construction belongs to verified boundary adapters ONLY:
  `verified API key → server-side key record → canonical api:<id> →
  TrustedExecutionContext`.
- No `fromSubject/fromMeta/fromHeaders/fromBody` helpers exist.
- `createTrustedExecutionContext` enforces: closed source union, source-bound
  subject grammar, raw-token rejection, actor/subject consistency, frozen object.
- Gateway verification remains gateway-owned (`resolveGatewayActor`,
  `src/gateway/dispatch-adapter.ts`).
- **KEEP-OUTSIDE:** `routeChat`, `ChatRequest`, anonymous `/chat` behavior,
  `web`-prefix handling, `p2_storage`, Telegram/Kilo, Browser OS, Provider OS,
  Dispatch planner/execution, `core/auth`, `core/authz`, capabilities, budgets —
  zero changes.

## 5. Negative contracts (forbidden, enforced)

```
ChatRequest identity fields            = forbidden
ChatRequest.meta as identity           = forbidden
system:runtime fallback                = forbidden
raw token in trusted context           = forbidden
untrusted source string                = forbidden (closed union)
```

Compile-time proof lives in `src/core/trusted-context/trusted-context.ts`
(`_chatRequestIdentityFree` — full-server tsc fails if any forbidden key is ever
added to `ChatRequest`). Runtime proofs in
`tests/unit/trusted-context/trusted-context.test.ts`.

## 6. Acceptance (recorded GREEN)

| Suite | Result |
|---|---|
| trusted-context | 10/10 |
| gatewayDispatch | 7/7 |
| gateway | 20/20 |
| gatewayStartup | 5/5 |
| planner | 17/17 |
| safe-execution | 16/16 |
| forge | 7/7 |
| worker | 13/13 |
| authz | 137/137 |
| full build (`tsc -p tsconfig.server.json`) | PASS (0 errors) |
| health / ready (isolated boot) | 200 / 200 |
| secret scan + `diff --check` | clean |
| `node_modules` / `screenshots` staged | NO |

## 7. Commits

- Feature (single, no push during batch): **`91b0505`**
  `refactor(dispatch): establish trusted execution context boundary`
- Docs-lock (this file): **see HEAD of this batch**

## 8. Deferred

- `bridge.internal` activation — BLOCKED until a proven server-controlled
  construction point exists.
- B4-B — Authenticated Gateway Full Dispatch Migration Gate (extend S2
  `local-demo` → one real authenticated non-demo provider path). NOT STARTED.