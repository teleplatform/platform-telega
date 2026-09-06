# PD-W3/B3-A — ForgeExecutionAdapter (Forge domain → Dispatch vNext)

STATUS: IMPLEMENTED (owner review pending; no commit/push until approved)
DECISION: implements docs/PD-W3-B3 lock — **one Dispatch authority, two executor domains**

Branch: `integration/runtime-recovery-index` · Baseline: B3 audit ACCEPTED 🔒 (`9af5198`)

---

## 1. Goal (from B3 audit §7 B3-A)

Forge execution → safe Dispatch hand-off → `ForgeExecutionAdapter` →
existing Forge executor → domain evidence preserved. `sigma_forge` stays
deferred/fail-closed (C5B-X precedent); only proven routes integrate.

## 2. What changed (exact surface)

| File | Change | Kind |
|---|---|---|
| `src/runtime/routing/action-route.types.ts` | +`"forge_bridge"` to `ActionRouteKind` | widen |
| `src/runtime/capability-vnext/capability.types.ts` | +`"forge_bridge"` to `CapabilityKind` | widen |
| `src/runtime/dispatch-vnext/forge-execution-adapter.ts` | NEW `ForgeExecutionAdapter implements DispatchExecutor` (route `forge_bridge`), `forgeDomainId`, `ForgeExecutionPort` | new |
| `src/runtime/dispatch-vnext/forge-runtime.ts` | NEW capability `cap.forge_bridge`, binding `{forge_bridge→forge_bridge→kilo_mcp, requires_provider:false}`, `createForgeRuntime`, `runForgeBuild` | new |
| `tests/unit/dispatch-vnext/forgeExecution.test.ts` | NEW 7-proof suite | new |
| `screenshots/flows/b3-forge/{capture.txt,test-run.txt,boot-proof.txt,evidence-records/,capstone.ts}` | capstone + server boot + regression artifact | new |

**KEEP-OUTSIDE audit — zero changes to:**
`dispatch-executor.ts`, `dispatch-bindings.ts`, `dispatch-planner.ts`,
`dispatch-execution.ts`, demo `runtime.ts`, `action-router.ts` (routing untouched),
`runtime/workers/*`, `availability/*`, `execution-evidence-store.ts` (no schema
widening), `server/index.ts`, `forge-bridge/*` adapters/executor/`job-dispatcher.ts`,
`kilo-mcp.adapter.ts`, Telegram/Kilo surfaces.

## 3. Adapter seam design

- Route `forge_bridge`; binding `requires_provider:false` → `DispatchPlanner.selectProvider`
  returns `null` (Provider OS stays out; domain keeps its own target selection).
- Adapter order (per authority map): **dispatch authz recheck** (coordinator) →
  **availability recheck** (coordinator on binding target `kilo_mcp`) → **forge domain
  capability gate** `assertForgeBridgeAllowed(domainUserId)` (~forge_access, on top of
  dispatch-authz) → **adapter-level target availability** (only `online` executes;
  `forge_http` degraded / `sigma_forge` unprovisioned → fail-closed with honest reason) →
  **real domain execution** (`ForgeBridge.run` → real `KiloMcpAdapter`).
- Identity translation: `forgeDomainId(subject)` takes the raw id from the *server-validated*
  subject (`maker:267246987` → `267246987`); the domain policy runs on the raw creator id.
  This is a boundary translation of a trusted actor — never an actor from payload.
- Outcome mapping: `done → completed` (full `ForgeResult` preserved as `output` = domain
  evidence); `partial|blocked|failed|thrown → failed` with domain reason. No second
  lifecycle written by the adapter (Dipatch coordinator owns it).
- Unique-once: coordinator `ledger` dedupes by `run_id` (proven by E2 test).

## 4. Acceptance evidence

B3 audit §8 checklist:

- [x] `tsc -p tsconfig.server.json --noEmit` — 0 errors.
- [x] Forge route `forge_bridge`: adapter + binding + descriptor registered; `runDemoReply`
      and `provider_bridge` untouched.
- [x] No shadow execution: exactly **1** transport hit per run (E1/E2, capstone).
- [x] Evidence single-lifecycle: `dispatch_started`/`execution_started`/`execution_finished`
      each exactly **1** per run; no duplicate ids; failed runs get honest
      `execution_finished=failed`.
- [x] Forge domain evidence preserved: dispatch output carries full `ForgeResult`
      (target/taskId/output/artifacts/traceId) — no stripping.
- [x] `sigma_forge` honestly deferred/fail-closed: no executor/binding/descriptor;
      `build_project → sigma_forge` routing untouched (no remap).
- [x] Authz negative matrix (forge): public `api:` actor reaches the adapter but is denied
      by the forge domain policy **before any transport call** (mock hits = 0).
- [x] Regression green: gateway 20, gatewayStartup 5, providerHealthDiagnostics 14,
      gatewayDispatch 7, safe-execution 16, dispatch-vnext-e2e PASS, B3-A 7.
- [x] Proof-gate for integrated route `kilo_mcp`: endpoint provisioned (in-process Fastify
      implementing the real `/v1/tools/<tool>` contract) + real execution through Dispatch
      captured (`screenshots/flows/b3-forge/`).
- [x] Full `server/index.ts` boot `/health` `/ready` both 200 (closes B2 NOT-EXERCISED).

## 5. Honest notes

- The capstone's `kilo_mcp` endpoint is in-process (real `KiloMcpAdapter` + real HTTP
  transport contract) — same pattern as the B2 gateway capstone; live-remote evidence
  remains a deployment-time proof-gate, not asserted here.
- `forge_http` stays un-integrated: `degraded`/remote, no provisioned endpoint → the
  adapter fails it closed with `FORGE_TARGET_DEGRADED` (consistent with the lock).
- `sigma_forge` stays un-integrated per owner correction (C5B-X precedent).
- Public actors cannot reach Forge through this adapter (domain gate). No gateway/server
  surface change exposes it — B3-A is in-process dispatch wiring only.

## 6. Evidence artifacts

- `screenshots/flows/b3-forge/capture.txt` — capstone run (real Forge execution through Dispatch).
- `screenshots/flows/b3-forge/evidence-records/evidence.jsonl` — real evidence chain.
- `screenshots/flows/b3-forge/test-run.txt` — tsc + suites + boot summary.
- `screenshots/flows/b3-forge/boot-proof.txt` — /health /ready bodies.
- `screenshots/flows/b3-forge/capstone.ts` — reproducible proof script.

## 7. Next

Owner review. On approval: commit (subject `docs(runtime): lock forge execution adapter`)
+ standard pre-commit checks + push `integration/runtime-recovery-index`. B3-B (Worker)
waits for explicit GO — no auto-start.