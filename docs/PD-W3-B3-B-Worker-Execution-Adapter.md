# PD-W3/B3-B — WorkerExecutionAdapter (Worker domain → Dispatch vNext)

STATUS: IMPLEMENTED (owner review pending; no commit/push until approved)
DECISION: implements docs/PD-W3-B3 lock + B3-B0 Worker Selector Ruling ACCEPTED 🔒
Branch: `integration/runtime-recovery-index` · Baseline: B3-A LOCKED 🔒 (`c168969`)

---

## 1. Goal (from B3 audit §7 B3-B + B3-B0 ruling)

Add Worker as the second Dispatch executor domain **without activating Worker
mode in production**. Canonical flow:

```
Dispatch → WorkerExecutionAdapter → assignNodeToWorker → findBestWorker
→ WorkerAssignment → worker transport/handler → result
```

`assignNodeToWorker` is the single canonical Worker-assignment entrypoint;
`findBestWorker` remains an internal selection primitive inside that belt;
`selectWorker` stays DEFERRED (dormant policy surface, no callers, no activation).

## 2. B3-B0 Selector Ruling (ACCEPTED 🔒)

- **Canonical Worker assignment authority:** `worker-assignment` belt
  (`assignNodeToWorker → findBestWorker → WorkerAssignment → tracking/evidence`).
- **Current selector primitive:** `findBestWorker` (internal to the belt).
- **`selectWorker`:** DEFERRED dormant policy surface — not a second authority,
  not wired into B3-B.

## 3. What changed (exact surface)

| File | Change | Kind |
|---|---|---|
| `src/runtime/routing/action-route.types.ts` | +`"worker_runtime"` to `ActionRouteKind` | widen |
| `src/runtime/capability-vnext/capability.types.ts` | +`"worker_runtime"` to `CapabilityKind` | widen |
| `src/runtime/dispatch-vnext/worker-execution-adapter.ts` | NEW `WorkerExecutionAdapter implements DispatchExecutor` (route `worker_runtime`), `WorkerExecutionPort`, `WORKER_RUNTIME_ROUTE`, `call_bridge_worker` gate | new |
| `src/runtime/dispatch-vnext/worker-runtime.ts` | NEW capability `cap.worker_execution`, binding `{worker_runtime→worker_runtime, requires_provider:false, no runtime_target}`, `createWorkerRuntime`, `runWorkerExecution`, `buildWorkerDispatchRequest` | new |
| `tests/unit/dispatch-vnext/workerExecution.test.ts` | NEW 13-proof suite | new |
| `screenshots/flows/b3-worker/{capture.txt,test-run.txt,boot-proof.txt,evidence-records/}` | acceptance artifacts | new |

**KEEP-OUTSIDE audit — zero changes to:**
`dispatch-executor.ts`, `dispatch-bindings.ts`, `dispatch-planner.ts`,
`dispatch-execution.ts`, demo `runtime.ts`, `action-router.ts` (routing untouched),
`runtime/workers/**` (Worker domain untouched — belt/registry/execution/handlers
unchanged), `worker-selection-policy.ts` (untouched), `worker-score-engine.ts`
(untouched), `availability/*`, `execution-evidence-store.ts` (no schema widening),
`server/index.ts`, Telegram/Kilo surfaces, AuthZ profiles (no broadening).

## 4. Adapter seam design

- Route `worker_runtime`; binding `requires_provider:false` → planner returns
  provider `null` (Provider OS stays out). **No `runtime_target`**: Availability
  does not model individual workers; Worker liveness stays Worker-domain truth.
  Dispatch does NOT fabricate a target/availability status.
- Adapter order (per authority map): **dispatch authz recheck** (coordinator) →
  **worker domain capability gate** `call_bridge_worker` (vNext profile, on top of
  dispatch-authz; public/api → denied before any Worker selection/transport) →
  **no transport wired → fail-closed** `WORKER_TRANSPORT_UNAVAILABLE` (dormant,
  integration-ready) → **canonical assignment** `assignNodeToWorker` (belt; not
  `findBestWorker` directly) → **transport execution** via `WorkerExecutionPort`
  → **belt tracking update** (assignment → completed/failed) → **domain output
  preserved** (workerId/assignmentId/evidence/outcome).
- Worker mode stays DORMANT: no `new WorkerRuntime()`, no `enableWorkerMode()`,
  no HTTP/Telegram/server surface. The port executes through an explicit
  transport injection only (tests); default is fail-closed.
- No second retry loop: reassignment/recovery remain Worker-domain controlled
  and distinct from Dispatch replay. Dispatch ledger still prevents duplicate
  execution of the SAME plan (unique-once).
- Outcome mapping: transport `ok → completed` (WorkerAssignment + WorkerResult
  preserved as domain evidence); `!ok`/throw → `failed` with domain reason; no
  worker available → `failed` (`WORKER_NO_AVAILABLE`, message from Worker domain).

## 5. Acceptance evidence (B3 §13 checklist)

- [x] **1** internal/system actor can plan Worker execution.
- [x] **2** public/api actor denied (`call_bridge_worker`) before any Worker invocation.
- [x] **3** `assignNodeToWorker` is the assignment entrypoint (belt not bypassed).
- [x] **4** selected assignment invokes exactly one worker execution.
- [x] **5** Dispatch does NOT call `selectWorker`.
- [x] **6** Dispatch does NOT score workers.
- [x] **7** duplicate safeExecute does not re-run transport (unique-once).
- [x] **8** dead/unavailable worker behavior remains Worker-domain controlled (no invented target).
- [x] **9** WorkerAssignment/tracking preserved.
- [x] **10** canonical Dispatch lifecycle written once.
- [x] **11** Worker domain evidence (assignment/output) intact; no lifecycle duplication.
- [x] **12** WorkerRuntime remains uninstantiated.
- [x] **13** Worker Mode remains disabled/direct.

Plus regression: `tsc` 0, forge 7, safe-execution 16, planner 17, vNext E2E PASS,
gateway 20, startup 5, diagnostics 14, gatewayDispatch 7, boot /health + /ready 200.

## 6. Honest notes

- Worker subsystem is **dormant**. B3-B proves **integration readiness**, NOT
  production activation. The default (no transport wired) fails closed;
  controlled acceptance uses a safe fake/local worker transport injected into
  the real `assignNodeToWorker` belt.
- Live production worker E2E = **NOT-EXERCISED** (acceptable per spec: no honest
  live worker exists; we do not fabricate production activity).
- No pre-existing dedicated Worker tests existed (domain dormant) — the 13-proof
  suite is the new Worker integration floor; Worker production modules unchanged.
- Pre-existing dormant-domain typecheck observations (product not part of this
  change surface, and excluded from the committed `tsconfig.server.json` build
  which passes at 0): `worker-score-engine.ts` (missing `successRate` field on
  `WorkerCapabilityMetrics`), `worker-degradation-policy.ts` (imports
  `updateWorkerStatus` not exported from `worker-execution-metrics.ts`),
  `worker-evidence-linkage.ts` (EvidenceLink unassignable to `Record<string,unknown>`),
  and `evidence/replay-*.ts` (missing `../capability/capability.types` module).
  These are the same B3-B0 audit-flagged dormant-domain defects; they remain
  out of B3-B scope (KEEP-OUTSIDE) and do not break the production build.

## 7. Evidence artifacts

- `screenshots/flows/b3-worker/capture.txt` — run summary (13-proof worker suite).
- `screenshots/flows/b3-worker/test-run.txt` — tsc + suites + dormancy invariant checks.
- `screenshots/flows/b3-worker/boot-proof.txt` — /health /ready bodies.
- `screenshots/flows/b3-worker/evidence-records/evidence.jsonl` — real evidence chain.

## 8. Next

Owner review. On approval: commit `feat(dispatch): add worker execution adapter`,
then separate docs lock commit. NO push/merge/deploy/tag until review. On the
docs-lock approval only — B3-B LOCKED 🔒. B4 awaits explicit GO.

Verdict (to be confirmed at lock): **B3-B GREEN — READY FOR B4**.
