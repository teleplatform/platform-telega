# FORGE SKILL GRAPH RUNTIME v1.0

**Статус:** `CANONICAL`
**Модуль:** `telega-city/sigma-forge`
**Роль:** execution operating layer над Tele•GPT control plane

---

## Purpose

Execution-first runtime: принимает `TaskIntentEnvelope`, строит DAG из skill units, исполняет с зависимостями, ведёт run ledger, собирает evidence.

---

## Planes

| Plane | Роль |
|-------|------|
| Tele•GPT Pack 1-3 | control plane: authz, capabilities, router, explain entry |
| Sigma Forge FSGR | execution plane: skill graph, DAG planner, node runner, ledger |
| Mission Control | truth plane: trace, evidence, audit, replay |

---

## Contracts

| Contract | File |
|----------|------|
| SkillUnit | `packages/fsgr-contracts/src/skillUnit.ts` |
| TaskIntentEnvelope | `packages/fsgr-contracts/src/taskIntentEnvelope.ts` |
| ExecutionGraph | `packages/fsgr-contracts/src/executionGraph.ts` |
| RunLedger | `packages/fsgr-contracts/src/runLedger.ts` |
| ContextCapsule | `packages/fsgr-contracts/src/capsule.ts` |
| ArtifactEnvelope | `packages/fsgr-contracts/src/artifactEnvelope.ts` |

---

## Lifecycle Entities

- **RunLedger**: журнал жизни запуска (created → planned → running → completed/failed/degraded)
- **ExecutionGraph**: DAG execution nodes + edges
- **ExecutionNode**: node lifecycle (pending → ready → running → completed/failed)
- **ContextCapsule**: сжатый snapshot состояния run
- **ArtifactEnvelope**: результат исполнения ноды

---

## Storage

SQLite: `fsgr_runs`, `fsgr_nodes`, `fsgr_artifacts`, `fsgr_capsules`, `fsgr_events`

---

## Ledger Facade

`createLedgerStore(deps)` — high-level facade над repos:
- `createRun`, `updateRun`, `getRun`
- `appendEvent`, `getEvents`
- `getNodes`, `updateNode`
- `saveCapsule`, `getCapsule`
- `createArtifact`

---

## Skills Core

13 canonical skills across 5 families:
- **Frontend**: react.component.build, ui.fix, layout.section.compose
- **Backend**: api.route.build, auth.guard.patch, db.schema.patch
- **Content**: doc.spec.write, copy.block.generate
- **Research**: scan.summarize, compare.synthesize
- **Ops**: test.run, trace.explain, patch.validate

---

## Retrieval + Selection

- Family-first retrieval: task_kind → candidate families → skills
- Policy-aware selection: mode, risk, deprecated exclusion
- Returns: selected skills + rejected with reason codes

---

## Planning

- **Normalize**: trim strings, defaults, normalize arrays
- **Classify**: deterministic task classification → family candidates, inferred tags, execution hints
- **Plan Modes**: fast/safe/quality/creator resolution
- **Decomposition**: deterministic work unit generation (1-5 units based on complexity)
- **DAG Builder**: builds ExecutionGraph with entry/terminal nodes, cycle rejection, missing dependency validation

---

## Execution Engine

- **Node Runner**: executes single node with handler binding, validation, artifact creation
- **Validator Layer**: pluggable validators (output-exists, output-non-empty, output-basic-shape)
- **Retry Engine**: retry policy with backoff, retryable error codes, max attempts
- **Fallback**: fallback_skill_id resolution from node or skill definition
- **Status Transitions**: explicit node lifecycle model with allowed transitions
- **Executor**: main execution loop with dependency resolution, batch execution, degraded continuation
- **Run Status Derivation**: completed/degraded/failed/running based on node states

---

## Benchmarks + Hardening

- **Benchmark Suite**: 4 canonical scenarios (code_repair, feature_build, research_artifact, ops_recovery)
- **Benchmark Runner**: deterministic execution with check collection
- **Benchmark Report**: machine-readable pass/fail with failure summaries
- **Idempotency**: duplicate event detection, controlled allow/deny
- **Loop Guard**: iteration limit, no-progress detection
- **Event Integrity**: lifecycle sequence validation, run/node event consistency
- **Storage Consistency**: run/node/artifact/capsule cross-validation
- **Explain Consistency**: explain vs ledger/event/capsule validation
- **Health Summary**: runtime-wide aggregation with integrity flags

---

## API Facades

| Method | Описание |
|--------|----------|
| `startFsgrRun(runtime, envelope)` | normalize → classify → retrieve skills → select → decompose → build DAG → persist → events → capsule |
| `executeFsgrRun(runtime, runId)` | execute all ready nodes with dependency resolution, retry, fallback |
| `resumeFsgrRun(runtime, runId)` | resume paused/degraded run |
| `retryFsgrNode(runtime, runId, nodeId)` | retry failed node |
| `getFsgrRun(runtime, runId)` | Получить RunLedger |
| `getFsgrRunGraph(runtime, runId)` | Получить ExecutionGraph (read model из nodes) |
| `getFsgrRunExplain(runtime, runId)` | Explain: summary + transitions + capsule + artifacts |
| `runFsgrBenchmarks(runtime)` | Run all 4 benchmark scenarios, return report |
| `getFsgrBenchmarkReport(runtime)` | Get last benchmark report |
| `getFsgrRuntimeHealth(runtime)` | Runtime health summary with integrity flags |

---

## Implementation Stages

| Stage | Что | Статус |
|-------|-----|--------|
| Stage 1 | Contracts + JSON Schemas | ✅ DONE |
| Stage 2 | Runtime package + storage + ledger + capsule + API facades + tests | ✅ DONE |
| Stage 3 | Skills core + retrieval/selection + intake + planning + DAG builder + integration | ✅ DONE |
| Stage 4 | Execution engine + validators + retries + fallback + degraded continuation | ✅ DONE |
| Stage 5 | Benchmarks + hardening + health summary | ✅ DONE |
| Stage 6 | Layered memory + review mesh + evidence deepening | ⏳ |
| Stage 7 | Production hardening + distributed readiness | ⏳ |

---

## Intentionally Deferred

- Layered memory fabric (Stage 6)
- Multi-agent reviewer mesh (Stage 6)
- Browser/operator bridge (later)
- Self-evolution (later)
- Multi-plan generation (later)
- LLM-based planning (later)
- Distributed worker mesh (later)
- Human-in-the-loop UI (later)
- External APM integration (later)
