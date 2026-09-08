# PD-W3/B5 — ACCEPTANCE + LEGACY AUTHORITY LOCK REPORT

STATUS: COMPLETE
DECISION: LOCKED

Branch: `integration/runtime-recovery-index`
Acceptance baseline: `d9e7b4e` (`docs(runtime): lock local auto recursion fix B4-D1`)
Audit date: 2026-09-08

## Executive verdict

PD-W3 has migrated execution authority far enough to close the program. Dispatch
vNext has real production consumers, authenticated migrated Gateway slices bypass
`routeChat`, and the remaining `routeChat` callers are explicit compatibility or
deferred-program surfaces. No unresolved execution-authority conflict remains.

The B5 audit changed no runtime source. The only program-finalization change is
this acceptance document.

## Canonical authority matrix

| Authority | Canonical module | Current callers / consumers | Second live authority | Classification |
|---|---|---|---|---|
| Runtime availability | `src/runtime/availability/availability-registry.ts` + `availability-defaults.ts` | Dispatch planner/execution and Forge target checks | No competing target-status registry in migrated slices | SINGLE |
| Action capability existence | `src/runtime/capability-vnext/capability-registry.ts` | Demo, provider-chat, Forge and Worker runtime composition | Legacy capability catalogues do not grant or resolve migrated Dispatch capabilities | SINGLE |
| Identity and permission | `src/core/trusted-context/*`, `src/core/authz/permissionResolver.ts`, Gateway `auth.ts` | Verified Gateway API key boundary, Dispatch planner and execution recheck | No payload/meta/ChatRequest identity path | SINGLE |
| Provider eligibility, selection and fallback | `src/runtime/provider/provider-router-v2.ts` and Provider OS registry/policy/score modules | Provider-backed Dispatch plans for demo and `provider_chat` | `routeChat` retains legacy selectors only for non-migrated callers | LEGACY-DEFERRED |
| Orchestration and safe hand-off | `src/runtime/dispatch-vnext/dispatch-planner.ts`, `dispatch-execution.ts`, binding and route registries | Gateway demo, Gateway provider chat, Forge adapter, Worker adapter | No parallel execution path for migrated slices | SINGLE |
| Forge domain semantics | `src/runtime/forge-bridge/*` | `ForgeExecutionAdapter` delegates one accepted hand-off; Forge owns target/DAG/scheduler semantics | Dispatch does not absorb or duplicate Forge domain authority | SINGLE |
| Worker domain semantics | `src/runtime/workers/*` | `WorkerExecutionAdapter` delegates through assignment belt in integration mode | Dispatch does not select/score workers | SINGLE |
| Canonical execution evidence | `src/runtime/evidence/execution-evidence-store.ts` and Dispatch coordinator hooks | All Dispatch executions | Forge/Worker domain records describe distinct domain facts, not a second Dispatch lifecycle | SINGLE |
| Legacy response/execution compatibility | `src/core/router.ts` (`routeChat`) | Anonymous HTTP, non-migrated Gateway models, p2 storage, Telegram mode flow, internal legacy reroute | Bypassed by every migrated authenticated slice | LEGACY-DEFERRED |

Conflict count: **0**.

## Dispatch production adoption

| Domain | Capability / route / binding | AuthZ and availability | Provider | Executor | Activation | Acceptance |
|---|---|---|---|---|---|---|
| demo | `cap.model.demo_reply` / `provider_bridge` / `kilo_mcp` | `agent.run`; target must be online | `local:llm` required | `DemoReplyExecutor` | Active for authenticated Gateway model `local-demo` | LIVE PASS: HTTP 200, real deterministic output, one lifecycle |
| provider_chat | `cap.provider_chat` / `provider_http` / no runtime target | `agent.run`; provider health remains Provider OS authority | `local:llm` required | `LocalChatExecutor` | Active for exact authenticated model `local:local-chat` | LIVE PASS: HTTP 200, canonical local leaf output, one lifecycle |
| forge_bridge | `cap.forge_bridge` / `forge_bridge` / `kilo_mcp` | owner/creator gate; `kilo_mcp` online; `sigma_forge` remains fail-closed | Not required | `ForgeExecutionAdapter` | Canonical runtime entrypoint enabled | INTEGRATION/LIVE-FIXTURE PASS: accepted domain result, one transport call |
| worker_runtime | `cap.worker_execution` / `worker_runtime` / no fabricated target | internal/system only; Worker domain owns liveness | Not required | `WorkerExecutionAdapter` | Integration-ready but dormant; direct mode remains default | INTEGRATION PASS 13/13; LIVE NOT-EXERCISED |

## routeChat caller matrix

| Caller | Classification | Trusted identity available | Does `routeChat` execute? | Reason retained | Blocks lock |
|---|---|---:|---:|---|---:|
| Gateway `local-demo` | AUTHENTICATED-MIGRATED | Yes, verified API key | No | Dispatch demo slice is exclusive | No |
| Gateway exact `local:local-chat` | AUTHENTICATED-MIGRATED | Yes, verified API key | No | Dispatch provider-chat slice is exclusive | No |
| Gateway all other model names | AUTHENTICATED-LEGACY | Yes | Yes | Provider-by-provider migration is explicitly deferred; no mechanical broad migration | No |
| Main Runtime `POST /v1/chat` | ANONYMOUS-COMPAT | No | Yes | Public compatibility floor; no canonical actor may be fabricated | No |
| Main Runtime `POST /chat` | ANONYMOUS-COMPAT | No | Yes | Public compatibility floor | No |
| `src/server/p2_storage.ts` agent/final-answer flows | INTERNAL-LEGACY | No canonical Dispatch context | Yes | Own policy/fallback and storage semantics remain a future de-dup program | No |
| `src/telegram/menu.ts` mode handler | TELEGRAM-DEFERRED | Telegram IDs exist but are not a trusted execution-context source | Yes | Telegram identity migration is a separate governed program | No |
| `src/bridge/orchestrator.ts` injectable `routeChatFn` contract | BRIDGE-DEFERRED | No proven server-controlled trusted producer at HEAD | Only when externally bound | Bridge trusted identity remains blocked/deferred | No |
| `src/core/router.ts` bounded internal reroute | INTERNAL-LEGACY | Inherits legacy request only | Yes | Web/auto compatibility and B4-D1 terminal guard | No |
| Gateway/router tests | DEV/TEST | Fixture-controlled | Yes where legacy behavior is the proof target | Regression coverage | No |

Authenticated migrated slices have `routeChat` call count **0**. Anonymous
compatibility remains on `routeChat` without invented identity.

## routeChat residual responsibilities

| Responsibility | Decision | Retirement condition |
|---|---|---|
| Anonymous `/v1/chat` and `/chat` compatibility | INTENTIONAL KEEP | A canonical anonymous/public identity design approved independently |
| Web/browser provider fallback | DEFERRED FUTURE PROGRAM | Browser OS and trusted browser-session authority accepted |
| `auto` routing compatibility | DEFERRED FUTURE PROGRAM | A non-recursive, governed auto-selection product capability exists |
| Non-migrated OpenAI/Qwen/Kimi/other cloud provider routes | DEFERRED FUTURE PROGRAM | Provider-specific Dispatch contracts and acceptance evidence exist |
| Legacy `ChatResponse` mapping and compatibility metadata | RETIRE-LATER | All callers have equivalent surface adapters |
| `p2_storage` delegated execution/fallback | DEFERRED FUTURE PROGRAM | Storage and provider policy de-dup audit completed |
| Telegram mode execution | DEFERRED FUTURE PROGRAM | Telegram trusted identity and permission boundary accepted |

UNRESOLVED BLOCKER count: **0**.

## Legacy retirement matrix

| Module / symbol | Status | Evidence |
|---|---|---|
| `provider-auto-router-v2/router.ts` | KEEP | Live `routeChat(model="auto")` compatibility path |
| `provider-auto-router-v2/scoringEngine.ts` | KEEP | Live dependency of the legacy auto router |
| `core/router/routerScoring.ts` | KEEP | Live dependency of legacy `modelRouter` |
| `core/llmFallback.ts` | KEEP | Live `p2_storage` fallback orchestration |
| `core/policyRouter.ts` | KEEP | Live `p2_storage` lane/provider policy |
| `callCreatorStable` | DEAD | Definition/export has no caller at canonical HEAD; deletion is outside B5 |
| `web-provider-stub` | KEEP | Live legacy web fallback used by `routeChat` and provider execution |
| `localAutoProvider` | BUG-BACKLOG | Dormant implementation; real `local:auto` restoration is a future product program |
| `localSafeCall` | RETIRE-LATER | Legacy helper/export chain; not activated by the B4-D1 guard |

No legacy module is deleted in B5.

## Anonymous compatibility floor

The minimum floor is `routeChat` behind main Runtime `POST /v1/chat` and
`POST /chat`, plus their legacy model families and response mapping. It covers
`auto`, web/browser prefixes, non-migrated cloud providers, concrete legacy
local aliases and fallback behavior.

Keeping this floor creates no dual authority for authenticated Dispatch paths:
Gateway `local-demo` and exact `local:local-chat` return from their Dispatch
branches before the legacy call site. No anonymous actor, `system:runtime`
fallback or ChatRequest identity is introduced.

## Security acceptance

| Required proof | Result |
|---|---|
| Valid verified API identity becomes canonical trusted context | PASS |
| Missing credential fails closed before Dispatch | PASS |
| Invalid credential fails closed before Dispatch | PASS |
| Self-asserted maker/telegram/meta identity cannot become trusted | PASS |
| Public/API actor cannot call Worker | PASS |
| Public actor is limited to local provider access | PASS |
| Capability existence does not grant permission | PASS |
| No `system:runtime` fallback | PASS |
| `ChatRequest` remains identity-free | PASS |
| No raw credential in evidence/log/git | PASS; pattern hits are deliberate redaction/compliance fixtures only |

## Regression results

All counts are from B5 reruns on baseline `d9e7b4e`:

| Suite | Passed | Failed | Skipped |
|---|---:|---:|---:|
| capability registry vNext | 21 | 0 | 0 |
| availability | 9 | 0 | 0 |
| trusted-context | 10 | 0 | 0 |
| dispatch planner | 17 | 0 | 0 |
| safe execution | 16 | 0 | 0 |
| dispatch vNext E2E | 1 | 0 | 0 |
| provider-chat runtime | 8 | 0 | 0 |
| Gateway aggregate | 56 | 0 | 0 |
| Forge execution | 7 | 0 | 0 |
| Worker execution | 13 | 0 | 0 |
| AuthZ aggregate | 137 | 0 | 0 |
| Provider OS aggregate | 215 | 0 | 0 |
| Legacy router locked aggregate | 94 | 0 | 0 |

Provider OS detail: capability 18, failure policy 30, health 34, quality 32,
scoring 23, selection 29, Zyloo API 27, fallback E2E 10, quota failover 12.

## Build/boot

- Full server TypeScript build check: `tsc -p tsconfig.server.json --noEmit` —
  PASS, 0 errors.
- Isolated canonical Runtime on `127.0.0.1:18787`: `GET /health` 200,
  `GET /ready` 200.
- Isolated authenticated Gateway on `127.0.0.1:18765`: `GET /health` 200.
- Both isolated processes were stopped after probes; existing user services were
  untouched.

## Capstone acceptance

| Probe | Actor | Route / plan | Terminal outcome | Evidence / duplicate count |
|---|---|---|---|---|
| A. Gateway demo | verified `api:<keyId>` | `model → provider_bridge → kilo_mcp`, Provider OS `local:llm` | HTTP 200, `Tele•GPT говорит: B5 demo capstone` | `dispatch_started=1`, `execution_started=1`, `execution_finished=1`, legacy completion=0 |
| B. Gateway local chat | verified `api:<keyId>` | `provider_chat → provider_http`, Provider OS `local:llm` | HTTP 200, exact requested model and canonical local leaf output | `dispatch_started=1`, `execution_started=1`, `execution_finished=1`, legacy completion=0 |
| C. local:auto | same verified API actor on legacy deferred lane | terminal B4-D1 guard | Two bounded HTTP 503 responses; Gateway `/health` remained 200 | no recursion/hang; non-retryable error contract retained |
| D. Forge | owner creator fixture | `forge_bridge → kilo_mcp` via real adapter and bounded local transport | completed accepted Forge result | exactly one transport call and one Dispatch lifecycle; domain evidence preserved |
| E. Worker | internal/system integration fixture | `worker_runtime` through assignment belt | integration completed | 13/13 suite; LIVE NOT-EXERCISED because Worker mode is dormant |

The capstone API key was revoked after the bounded probe. No raw key was logged
or committed.

## Evidence acceptance

- Each migrated Gateway execution produced one Dispatch lifecycle.
- No `ide.gateway.execution.completed/failed` lifecycle was emitted for migrated
  slices.
- Forge and Worker evidence remains domain-specific and distinct from Dispatch
  lifecycle authority.
- Gateway request/model-resolution records remain surface/context facts.
- The shared `execution_started` string across Gateway surface and Dispatch
  lifecycle remains a non-blocking Evidence Taxonomy Hygiene item. No consumer
  ambiguity or double execution was demonstrated.

## B4-D1 verification

- `local-auto-failclosed`: 4 passed, 0 failed, 0 skipped.
- Two live bounded authenticated Gateway probes returned HTTP 503.
- No recursion, hang, retry loop or fallback execution occurred.
- Gateway health remained HTTP 200 after the repeated probes.
- `local-demo` and `local:local-chat` both returned HTTP 200 before the probes.

B4-D1 remains closed.

## Deferred programs

| Program | Why deferred | Current canonical behavior | Blocker | Security impact |
|---|---|---|---|---|
| OpenAI provider migration | No provider-specific Dispatch acceptance | Authenticated non-migrated requests use legacy `routeChat` | Contract + tests + evidence | Must preserve provider permission and secret isolation |
| Qwen provider migration | Same | Legacy route | Provider-specific migration pack | No trust broadening allowed |
| Kimi provider migration | Same | Legacy route | Provider-specific migration pack | No trust broadening allowed |
| `provider.remote.use` governance | Policy not canonically defined for Dispatch | Existing provider policy remains authoritative in current lanes | Explicit permission design | High: remote data egress |
| Telegram/Kilo | Telegram identity is not TrustedSource | Telegram mode path remains legacy | Verified server-bound identity producer | High: self-asserted IDs forbidden |
| Bridge trusted identity | No proven server-controlled construction point | Bridge contract remains deferred | Trusted producer + source grammar | High: creator privilege boundary |
| `p2_storage` de-dup | Own policy/fallback/storage behavior | Continues on legacy path | Separate authority audit | Medium: avoid accidental dual execution |
| Ollama/local executor family | Only exact `local:local-chat` is proven | Exact slice Dispatch; other aliases legacy | Alias equivalence + transport acceptance | Preserve local-only policy |
| Browser OS | Browser authority not accepted in PD-W3 | Web fallback stays legacy | Session/auth/evidence governance | High: session credentials |
| local:auto product restoration | B4-D1 intentionally fail-closed | Controlled non-retryable 503 | Real selector leaf + bounded retry model | Availability/DoS risk |
| Evidence taxonomy hygiene | No actual duplicate execution | Shared name retained | Consumer/schema migration plan | Low while semantics remain distinct |
| Worker policy selector activation | Worker runtime dormant | Integration-ready only | Product activation and liveness proof | Internal/system gate must remain |
| sigma_forge external integration | No registered safe executor target | Explicit fail-closed/deferred route | External runtime contract and availability | High: repo/terminal execution |

These programs are post-PD-W3 work, not hidden unfinished PD-W3 scope.

## PD-W3 exit criteria

| # | Criterion | Result |
|---:|---|---|
| 1 | Dispatch vNext has real production consumers | PASS |
| 2 | Authenticated migrated slices bypass `routeChat` | PASS |
| 3 | Trusted identity boundary is canonical | PASS |
| 4 | Provider selection authority is not duplicated in migrated slices | PASS |
| 5 | Forge/Worker domain authorities remain outside Dispatch | PASS |
| 6 | `routeChat` residual use is classified and intentional | PASS |
| 7 | No unresolved critical execution-authority conflict remains | PASS |
| 8 | Full build passes | PASS |
| 9 | Isolated boot passes | PASS |
| 10 | Security matrix passes | PASS |
| 11 | B4-D1 remains closed | PASS |
| 12 | Deferred programs are explicit | PASS |
| 13 | No required HTTP/UI/Adapter migration remains in current scope | PASS |

## Legacy authority lock decision

**A. `routeChat = INTENTIONAL LEGACY COMPATIBILITY SURFACE`.**

Its residual responsibilities are anonymous HTTP compatibility, non-migrated
provider families, web/auto compatibility, response mapping, `p2_storage`,
Telegram mode execution and bounded internal legacy rerouting. Retirement is
allowed only through separately accepted identity/provider/surface migration
programs. Residual use must not be described as an incomplete PD-W3 migration.

## Tag recommendation

TAG RECOMMENDED: **YES**

Recommended annotated tag: `pd-w3-execution-migration-v1`

Target: the final docs acceptance commit containing this report, not baseline
`d9e7b4e`. The tag records the program lock after acceptance evidence is made
part of repository history.

## Commit/push/deploy state

- Baseline branch state before this report: local and origin were `0/0` at
  `d9e7b4e`.
- One docs-only acceptance commit is required and authorized by the owner.
- Push of that acceptance commit and the annotated tag is required to publish
  the lock.
- Merge and deployment are separate actions and are not performed by B5.
- Untracked `node_modules` and `screenshots/flows/b3-worker/` are excluded from
  the acceptance commit.

## Final verdict

PD-W3 COMPLETE — READY TO LOCK
