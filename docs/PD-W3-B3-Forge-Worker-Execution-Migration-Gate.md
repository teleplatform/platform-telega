# PD-W3/B3 — Forge + Worker Execution Surface Migration Gate
STATUS: AUDIT (READ-ONLY, no implementation)
DECISION: ACCEPTED 🔒 (post-review corrections: `sigma_forge` fail-closed; evidence coexistence)

Branch: `integration/runtime-recovery-index` · Worktree: `tele-gpt-runtime-integration`
Baseline: B2 LOCKED 🔒 (`115b1d0` + `e6cf03c`, pushed `origin/integration/runtime-recovery-index`)

---

## 1. Audit question

Должны ли Forge execution и Worker execution быть:

- (A) двумя executor-доменами, подключёнными к **одному** Dispatch ExecutionRouteRegistry,
- или (B) требовать **разных orchestration authorities** (т.е. отдельные диспетчеры/исполнительные слои поверх dispatch)?

Формулировка гипотезы (владелец):

```
Dispatch vNext
├── ForgeExecutionAdapter    (kilo_mcp, forge_http, sigma_forge — если позже разблокирован)
└── WorkerExecutionAdapter   (local worker, remote worker)
```

При этом Forge scheduler/DAG и Worker liveness/selection **не засовывать** внутрь Dispatch —
они остаются domain-specific planning/state authorities. Dispatch владеет только
**моментом безопасного execution hand-off**.

## 2. That hypothesis is TESTABLE — evidence below

## 3. Evidence: текущее состояние трех слоёв

### 3.1 Dispatch vNext (единственная production-поверхность на сегодня)

- Executors: **только** `DemoReplyExecutor`, route `provider_bridge` (`src/runtime/dispatch-vnext/dispatch-executor.ts:38-58`, регистрация `runtime.ts:88`).
- Bindings: **только** `DEMO_REPLY_BINDING` (`model → provider_bridge → kilo_mcp`, `requires_provider: true`) — `dispatch-vnext/runtime.ts:35-40`.
- Capability descriptors: **только** `DEMO_REPLY_CAPABILITY` (`cap.model.demo_reply`, kind `model`) — `runtime.ts:19-33`.
- `ExecutionRouteRegistry.register` держит **уникальность по `execution_route_kind`** (`dispatch-executor.ts:20-24`) — значит два домена могут жить в одном Registry, если у них разные route kinds.
- `ActionRouteKind` (`src/runtime/routing/action-route.types.ts:1-8`): `direct_answer | sigma_forge | provider_bridge | browser_agent | voice_runtime | mission_control | manual_review`.
  - **`sigma_forge` уже существует как route kind**, но без executor/binding.
- `CapabilityExecutionBinding.requires_provider` (`dispatch-bindings.ts:5-10`): при `false` `DispatchPlanner.selectProvider` возвращает `null` (`dispatch-planner.ts:162-164`) — Provider OS в планировании не участвует. Это рычаг для доменов с собственным селектором.
- Dispatch владеет: authz recheck (`dispatch-execution.ts:102-129`), availability recheck (`:131-138`), сбор evidence (`:188-228`).

### 3.2 Forge execution surface (полностью самодостаточный стек, dispatch не задействован)

- **Scheduler loop (доменный authority)**: `src/runtime/forge-bridge/dag-wave-scheduler-loop.ts:123-335` (`runScheduler`), очередь/волны `dag-ready-queue-scheduler.ts:28-71`, `dag-wave-dispatch.ts:18-91`; persistent state — SQLite `scheduler-persistence.ts` + `scheduler-run-store.ts` (governance pause/resume/cancel, `:141-235`).
- **DAG/readiness (доменный authority)**: `task-group-store.ts:114-168` (рекурсивная `evaluateTaskReadiness`), `src/runtime/sigma-forge/execution-graph.ts` (топологическая сортировка/группы), `dag-runtime.ts:33-176` (по-групповое исполнение с retry).
- **Job dispatcher (доменный authority)**: `forge-bridge/job-dispatcher.ts:100-206` (`dispatchReadyDagTasks`, свой readiness-цикл, батчинг), `dispatchBuildTask` `:220-275`.
- **Executor bridge**: `forge-bridge.ts:39-78` (`run`), `forge-bridge-executor.ts:22-45` (switch по target), `executor-router.ts:21-57` (решение target: kilo_mcp/forge_remote/sigma_forge).
- **Адаптеры-исполнители**: `adapters/forge-http.adapter.ts:45-88` (forge_remote HTTP), `adapters/kilo-mcp.adapter.ts:30-100` (POST `${endpoint}/v1/tools/<tool>`), `adapters/sigma-forge.adapter.ts:129-357` (sandbox: analyze_repo/generate_patch/execute_kilocode_task/verify_runtime).
- **Свой evidence authority**: `forge-invocation-evidence.ts` + `forge-evidence-store.ts` (JSONL) + suite `forge-evidence-*.ts` (query/export/telegram/operator). **Осознанно сосуществует** с Dispatch lifecycle (это разные факты: domain proof vs lifecycle); при B3-A убирается только дублирующий lifecycle-слой, domain-specific proof остаётся.
- **Своя authz authority**: `forge-bridge-policy.ts:18-73` (`assertForgeBridgeAllowed`/`assertKiloMcpAllowed`/`getAllowedForgeTargets` через `hasCapability`/`getRuntimeRole`) — не `permissionResolverV2`.
- **Целевые targets**: `kilo_mcp` (online, local; capabilities `build_task/replay/local_execution`), `forge_http` (degraded, remote; `remote_execution`) — `availability-defaults.ts:3-16`. `sigma_forge` — только type-literal в `CapabilityKind`/`ActionRouteKind`, без descriptor/binding/executor.
- **Висящий маршрут (важно для B3)**: `src/runtime/routing/action-router.ts:18-23,46-50` уже роутит `build_project`/`modify_repo`/`publish_content → sigma_forge` (`build_task_required: true`), но в `ExecutionRouteRegistry` **нет executor** под `sigma_forge` — routing слой выдаёт маршрут, который никто не исполняет. Этот разрыв B3-A делает **явным и fail-closed** (см. §5, §7), а не «закрывает» его.
- **Legacy DB-worker**: `src/worker/forgeWorker.ts:14-53` (`runForgeOnce`, свой CAS-цикл по `db.tasks`, heartbeat) + `src/app/api/v1/forge/run-once/route.ts` (maker-gated HTTP trigger).

### 3.3 Worker execution surface (самодостаточный домен, работать с dispatch = ноль)

- `src/runtime/workers/` (26 файлов), `dispatch-*` импортов **ноль**; `dispatch-vnext/` не упоминает worker. Единственный общий элемент — **evidence**: `worker-execution.ts:62,97`, `worker-evidence-linkage.ts:48` пишут через dispatch `appendEvidenceRecord`/`hashTraceId` — общий evidence authority уже факт.
- **Доменные authority**: pool/registry `worker-registry.ts:4`; liveness `worker-heartbeat.ts:8-25` (30s, dead 120s) + `remote-heartbeat.ts:8-26` (HTTP `/worker/v1/ping`); **два конкурирующих селектора** `findBestWorker` (least-loaded, `worker-assignment.ts:13-24`, вызывается из `worker-runtime.ts:89-91`) и `selectWorker` (policy, `worker-selection-policy.ts:20`), scorer `worker-score-engine.ts:17-61`; degradation `worker-degradation-policy.ts:34-113`; recovery `worker-failure-recovery.ts:13-71`; federation `worker-federation-registry.ts:73-120` (HMAC auth `worker-auth.ts:18-95` на `WORKER_FEDERATION_SECRET`); persistence `worker-performance.jsonl` (`worker-performance-store.ts:20`).
- **Селекция НЕ provider-совместима**: ключуется по sigma-forge `RuntimeCapability`/`TaskType`, не по `ProviderProfile` strengths; `ProviderStrength` не выражает эти capability. Подключение через Provider OS = дублирование чужого authority (`worker-score-engine`+`worker-selection-policy`) — против гипотезы.
- **Пул**: 6 default локальных воркеров (`browser/memory/execution/evidence/governance/goals`, `worker-runtime.ts:25-74`, kind `local`); remote — только программная регистрация (`registerRemoteWorker`, `federateWithRemote`), **нет env/config remote worker**; единственный env key — `WORKER_FEDERATION_SECRET`.
- **Dormant/opt-in**: `new WorkerRuntime()` не вызывается нигде в `src/` (только type-imports в sigma-forge); sigma-forge default `mode:'direct'` (`sigma-forge-worker-config.ts:13-21`); `enableWorkerMode` не имеет call-site.
- **Authz**: свой HMAC; диспетчерская capability `call_bridge_worker` есть только у `internal`/`system` (`profiles.ts:111,139`) — **не** у `public`. Если Worker станет dispatch-доменом под public-акторами — `permissionResolverV2` по своей логике это зарежет (no capability) → Worker must оставаться internal/system-gated.

## 4. Authority map (кто чем владеет сегодня)

| Authority | Dispatch vNext | Forge (домен) | Worker (домен) |
|---|---|---|---|
| Planning/выбор маршрута | DispatchPlanner | executor-router + sigma intent/decomposer + scheduler loop | assignment/policy selector |
| Scheduler loop / очередь | нет (single-shot) | dag-wave-scheduler-loop, ready-queue, job-dispatcher | assignment pool, heartbeat sweep |
| DAG traversal/retry | нет | execution-graph, dag-runtime, retry-policy | (node-level) |
| Liveness/health | availability registry | (нет отдельного) | heartbeat local+remote, degradation |
| Authz | permissionResolverV2 (public: run_agent) | forge-bridge-policy (role/cap) | HMAC (WORKER_FEDERATION_SECRET) |
| Evidence | appendEvidenceRecord (canonical) | **свой JSONL/в-памяти** | общий appendEvidenceRecord |
| Availability targets | getTargetStatus | kilo_mcp/forge_http (общие, не используются в flux) | — |

## 5. Verdict — рекомендация аудита

**Принять гипотезу: ОДИН Dispatch authority, ДВА executor domain'а** (вариант A). Обоснование:

1. **Registry уже рассчитан на это**: `ExecutionRouteRegistry` индексируется по уникальному `execution_route_kind`; двух доменов хватает двух route kinds.Binding `requires_provider` уже даёт рычаг: домен с собственным селектором → `requires_provider:false` и Provider OS осознанно не участвует.
2. **Forge и Worker — разные по природе домены, но не разные orchestration authorities.** Оба имеют богатые доменные planning/state слои (Forge: scheduler/DAG/governance; Worker: liveness/selection/degradation/federation), которые НЕ надо дублировать в dispatch. Момент «я выполняю единицу работы под доверенным актором» у обоих одинаковый → один `DispatchExecutionCoordinator` + recheck + evidence lifecycle + availability.
3. **Evidence — сосуществование без дублирования lifecycle**: Dispatch lifecycle (`planned / execution_started / execution_finished`) и Forge domain evidence (`DAG / task / artifact / verification / domain outcome`) описывают **разные факты** и могут сосуществовать. Убираем только **дублирующий lifecycle**; domain-specific proof остаётся. Worker уже пишет в канонический store.
4. **`sigma_forge` — НЕ закрываем, только fail-closed**: `sigma_forge` уже есть в `ActionRouteKind` и уже назначается `action-router` для `build_project`/`modify_repo`, но executor под этим kind отсутствует. C5B-X-прецедент (внешний `sigma-forge` не был provisioned) запрещает незаметно вернуть этот integration через другую дверь. B3-A:
   - делает разрыв «routing → исполнение» для `sigma_forge` **явным и fail-closed** (роут остаётся deferred/unavailable до отдельного external-integration gate);
   - **не** перенаправляет `build_project → sigma_forge` на `kilo_mcp`;
   - **не** придумывает `sigma_forge` executor;
   - **не** добавляет внешний dependency;
   - **не** объявляет route рабочим.
   Доказанные Forge routes (`kilo_mcp`, `forge_http`) подключаются к Dispatch **только если closure/live truth доказаны**; иначе они тоже fail-closed.
5. **НЕ Provider-selection, НЕ scheduler**: подключать Forge/Worker селекцию в Provider OS ИЛИ тащить scheduler/liveness в Dispatch = анти-паттерн против гипотезы. Dispatch = безопасный hand-off; домен = выбор внутри адаптера.

**Точная граница ответственности после B3:**

| Слой | Владелец |
|---|---|
| Что исполнять (какой построить/запустить) | Forge domain (executor-router / job-dispatcher / scheduler) · Worker domain (assignment/selection) |
| Что это за маршрут/капability/таргет | Dispatch planner (capability→binding→route→target) |
| Кто может это исполнить (actor/authz recheck) | **Dispatch** (`permissionResolverV2` + resolveActor) |
| Жив ли там target (availability recheck) | **Dispatch** (`getTargetStatus`) |
| Единственный evidence lifecycle | **Dispatch** (canonical `appendEvidenceRecord`, `dispatch_started→execution_started→execution_finished`) |
| Execution hand-off unique-once | **Dispatch** (`ledger` в `DispatchExecutionCoordinator`) |
| Scheduler/DAG/liveness/federation селекция | Forge/Worker domain (остаётся снаружи) |

**Требуемые для реализации B3 (аудит, не выполняемся):**
- Route kinds: Forge-адаптер — **новый** `forge_bridge` (НЕ `sigma_forge`: он deferred/fail-closed); Worker — новый `worker_runtime`. Route rules в `action-router.ts` под эти kinds — позже, в фазе имплементации; `build_project→sigma_forge` не переназначается.
- Capability descriptors: `cap.forge_bridge` (kind `forge_bridge`) и `cap.worker_execution` (kind `worker_execution`) в capability-vnext (+ расширить `CapabilityKind`).
- Bindings: `{forge_bridge → forge_bridge route → target kilo_mcp|forge_http (только если proven), requires_provider:false}` и `{worker_execution → worker_runtime route → target local|remote-worker, requires_provider:false}`.
- Executors: `ForgeExecutionAdapter implements DispatchExecutor` (bridge к доменному forge-исполнению) и `WorkerExecutionAdapter implements DispatchExecutor` (bridge к `worker-runtime.executeNode`/assignment), зарегистрированные в `ExecutionRouteRegistry`.
- Ауthz гейт: Worker доступен только для `internal`/`system` (нет `call_bridge_worker` у public); Forge — по доменной политике поверх dispatch-authz.
- Evidence: `planned/execution_started/execution_finished` — канонический Dispatch lifecycle (пишется один раз); Forge domain evidence (`DAG/task/artifact/verification`) остаётся в Forge-слое — **не удаляется**. Дублирующий lifecycle убирается; domain-specific proof сохраняется.
- DI: между фазами B3-A (Forge first) и B3-B (Worker) — см. §7.

## 6. Ответ на «share one registry или два domain'а» — одним абзацем

**Одна Dispatch authority, два executor domains, два route kinds в одном `ExecutionRouteRegistry`, два доменных planning/state authority, остающихся снаружи.** Это ровно конфигурация гипотезы; B3 имплементом должен провести Forge (активная production-поверхность, `kilo_mcp` online) первым, а Worker (dormant, opt-in, remote-пул не настроен) — как независимый адаптер после, с internal/system-гейтом.

## 7. Recommended B3 implementation contract (audit-only decision; выполняется после утверждения)

- **B3-A: ForgeExecutionAdapter** (первый production-домен после demo):
  1. Зарегистрировать `ForgeExecutionAdapter` (route `forge_bridge`) + binding `{forge_bridge → forge route, target kilo_mcp|forge_http, requires_provider:false}` + descriptor `cap.forge_bridge`. **Интеграция каждого route только если closure/live truth доказаны** (endpoint provisioned + реальное исполнение проверено); непроваданный route → fail-closed.
  2. Адаптер вызывает доменный forge-исполнитель (`forge-bridge.run`/`job-dispatcher.dispatchBuildTask`) только после dispatch authz/availability recheck; scheduler/DAG/readiness/task-group state остаются в forge-bridge.
  3. Dispatch lifecycle (`planned/execution_started/execution_finished`) пишется канонически, один раз. Forge domain evidence (`DAG/task/artifact/verification/domain outcome`) остаётся сосуществовать в Forge-слое — **не удаляется**.
  4. **`sigma_forge` — fail-closed**: разрыв `action-router → sigma_forge` делается явным (роут остаётся deferred/unavailable), без remapping на kilo_mcp, без выдуманного executor, без external dependency, route не объявляется рабочим (C5B-X прецедент).
  5. `kilo_mcp` (online) — целевой happy-path только после proof-gate; `forge_http` (degraded) — fallback второго-уровня только после proof-gate; иначе fail-closed с честным reason.
- **B3-B: WorkerExecutionAdapter** (независимый домен, после B3-A или параллельно по решению):
  1. Новый route kind `worker_runtime` + binding `{worker_execution → worker_runtime, target local/remote-worker, requires_provider:false}` + descriptor `cap.worker_execution`.
  2. Адаптер дергает доменный `worker-runtime.executeNode`/assignment; selection/liveness/degradation остаются в `runtime/workers/`.
  3. Authz: доступен только `internal`/`system` (`call_bridge_worker`); public-запросы — deny до executor.
  4. Remote worker пул остается программной регистрацией; document: без `WORKER_FEDERATION_SECRET` домен не покидает local.
- **Общее для B3 (оба адаптера)**: уникальность маршрута, `ledger` dedupe, `execution_finished=completed/failed`, без двойного evidence, без передачи actor из payload.

## 8. Acceptance Gate — B3 (checklist для стадии реализации, НЕ выполняется в этом аудите)

- [ ] `tsc -p tsconfig.server.json --noEmit` — 0 ошибок (включая новые route kinds/bindings).
- [ ] Forge route `forge_bridge`: ForgeExecutionAdapter + binding + descriptor зарегистрированы; `runDemoReply` и `provider_bridge` не затронуты.
- [ ] Worker route `worker_runtime`: executor+binding+descriptor; внутренний селектор домена вызывается только внутри адаптера.
- [ ] Authz negative matrix: public→worker = до executor deny; forged actor в payload = не становится subject.
- [ ] В Forge-домене ровно один canonical Dispatch lifecycle (`dispatch_started→execution_started→execution_finished`) на run; Domain Forge evidence (DAG/task/artifact/verification) сохраняется; дублирующий lifecycle = 0; `ide.*`-дупликатов нет.
- [ ] No shadow execution: dispatch-результат = единственный результат; доменный scheduler не «добивает» повторно; legacy executor при dispatch-run не вызывается параллельно.
- [ ] **`sigma_forge` честно deferred/fail-closed**: разрыв `action-router → sigma_forge` остаётся явным (no remap на kilo_mcp, no выдуманный executor, no external dependency, route не объявлен рабочим).
- [ ] Regression: demo/gateway suites (7 + 20 + 5 + 14), safe-execution 16, vNext E2E — все PASS.
- [ ] Proof-gate для интегрируемых Forge routes: endpoint provisioned + real исполнение через Dispatch зафиксировано (скрины/артефакт в `screenshots/flows/b3-forge/`).
- [ ] Полный `server/index.ts` boot `/health` `/ready` — закрывает NOT-EXERCISED из B2 в области B3.

## 9. Deferred / dependencies

- `sigma_forge` target в availability и sigma-forge sandbox — разблокировать позже, отдельным гейтом (в B3-A только kilo_mcp/forge_http).
- Worker remote пул — нет конфига/env; federation требует `WORKER_FEDERATION_SECRET`; тестируем локально.
- Unify двух селекторов Worker (`findBestWorker` vs `selectWorker`) — отдельная техническая работа, вне B3 (аудит фиксирует дефект).
- `llmFallback/policyRouter/callCreatorStable/routeChat full/replay/Telegram/Kilo/Browser` — остаются B1-deferred, не входят в B3.

## 10. Next

Audit сначала на валидацию владельцем. После утверждения вердикта «один Dispatch + два executor domains»:
- Открыть **PD-W3/B3-A — ForgeExecutionAdapter** (implementation).
- Worker — отдельный **PD-W3/B3-B**, стартует по решению после B3-A.
- No auto-start: ждёт явного GO.

---

### Evidence / proof

Аудит read-only: инвентарь составлен по `file:line` (см. §3). Никаких изменений кода.
Референсы-источники: `src/runtime/dispatch-vnext/*`, `src/runtime/routing/action-route.types.ts`, `src/runtime/forge-bridge/*`, `src/runtime/sigma-forge/*`, `src/runtime/workers/*`, `src/runtime/availability/*`, `src/runtime/capability-vnext/*`.