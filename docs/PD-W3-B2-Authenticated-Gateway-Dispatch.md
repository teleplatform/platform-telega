# PD-W3/B2 — Authenticated Gateway → Dispatch vNext
STATUS: COMPLETE
DECISION: LOCKED 🔒

Branch: `integration/runtime-recovery-index` · Worktree: `tele-gpt-runtime-integration`
Commit: `115b1d0` (`feat(gateway): route authenticated demo execution through dispatch vNext`)

---

## 1. Scope
Первый production consumer Dispatch vNext:
authenticated OpenAI-compatible Gateway `local-demo` slice.

routeChat:
UNCHANGED

ChatRequest:
UNCHANGED

HTTP contract:
UNCHANGED

Adapter/UI contract:
UNCHANGED

## 2. Before
Gateway
→ routeChat
→ localDemo
→ legacy execution/evidence

## 3. After
Gateway auth
→ verified API identity
→ GatewayDispatchAdapter
→ Dispatch vNext
→ Safe Execution
→ DemoReplyExecutor
→ canonical evidence
→ existing Gateway response

## 4. Trusted Identity
Точная цепочка (документировано реализацией):

```
gatewayAuthMiddleware                    src/gateway/auth.ts — принимает только валидный `Authorization: Bearer` API-ключ
→ validateApiKey(token)                  src/api-keys/store.ts — hash-verified key record (id, clientType, allowedModels, permissions, status, expiry)
→ verified API key                       req.__apiKey (TeleGptApiKey), status=active, permission.chat
→ resolveGatewayActor(key)               src/gateway/dispatch-adapter.ts
→ canonical subject `api:<keyId>`        (key.id, e.g. `api:key_1788692447540_356490e0`)
→ resolveActor(subject)                  src/core/authz/actor.ts — canonical kind map: `api` → kind "api", role "public", mode "public"
→ canonical authz                        action=agent.run, resource=session:<run_id>, is_owner=false, visibility_scope=public
→ DispatchPlanner.authorize              permissionResolverV2 — public profile grants `run_agent` (profiles.ts) → ALLOW
```

Обязательно (confirmed):
- no raw token propagation — secret hash никогда не покидает `validateApiKey`; в dispatch идёт только `api:<id>`
- no ChatRequest subject — `ChatRequest` не модифицирован
- no self-asserted maker/telegram identity — subject является чистой функцией от `key.id`, никакие поля payload не участвуют
- no `system:runtime` fallback — для gateway actor не используется

## 5. Execution invariant

Доказано:

- legacy execution XOR Dispatch execution — для `local-demo` Dispatch only; для non-demo путь legacy (`routeChat`) не изменён
- No shadow execution — dispatch ветка ревращает и `return reply.send(...)`, legacy не исполняется
- No duplicate execution — capstone и тесты показывают ровно один `execution_finished` на request
- No fallback recursion — dispatch результат отображается напрямую в Gateway response; повторного входа в `routeChat` нет

## 6. Evidence
Подтверждён единственный execution lifecycle на request:

```
dispatch_started     route=provider_bridge target=kilo_mcp provider=local:llm
→ execution_started  run_id=<req_...>
→ execution_finished lifecycle=completed
```

Gateway-level request/context события сохраняются как distinct semantic events:
- `ide.gateway.request.received-<req>` (request-received, payload apiKeyId/clientType/model)
- `ide.gateway.model.resolved-<req>` (context_routed, executionLane=dispatch_vnext)

Отдельно доказано:
- `ide.gateway.execution.*` duplicate lifecycle = **0** (проба в капстоуне и тест E1, негативная проверка в имплементации — ветка не пишет ide.gateway.execution.completed/failed)
- No Evidence schema changes — используются только существующие типы записей

## 7. Response compatibility
Подтверждено:
- existing Gateway response schema unchanged — `OpenAiChatCompletionResponse` (toOpenAiResponse), `chat.completion`
- localDemo output preserved — `Tele•GPT говорит: <msg>` (идёт из реального `DemoReplyExecutor` → `localDemo`)
- HTTP status behavior unchanged — 200 успех, 401 авто-гейт, 403 модель-гейт, ошибки через существующий error-map + `err.errorType` override
- model/provider attribution unchanged where applicable — `model:"local-demo"`, provider attribution в canonical evidence (`local:llm`)
- non-demo requests unchanged — legacy `routeChat` ветка не тронута (см. капстоун Run 3)

## 8. Security
PASS:
- valid verified bearer → canonical actor `api:<id>` (tested U1, capstone Run 1)
- missing credential → 401 до dispatch (test E3, capstone Run 2)
- forbidden model/action → 403 до dispatch (test E4; action-denined маппится в 403 permission_denied через `GatewayDispatchError`)
- forged identity cannot become actor — payload/header не содержат канала для identity; subject = `api:${key.id}` (test U1/U2, impl)
- no capability→permission shortcut — разрешение идёт через канонический `permissionResolverV2` (run_agent для public), не через обход
- no raw credential in evidence/log/git — secret-scan staged diff clean; записывается только `apiKeyId`, не токен

## 9. Tests
Recorded, exact (`screenshots/flows/b2-gateway-dispatch/test-run.txt`):

```
B2 gatewayDispatch       7/7
gateway                  20/20
gateway startup           5/5
health diagnostics       14/14
dispatch safe-execution  16/16
dispatch vNext E2E        PASS
```

Full server tsc:
PASS / 0 errors (`npx tsc -p tsconfig.server.json --noEmit`)

## 10. Live / isolated acceptance
**PASS — isolated capstone run** через реальные production-модули
(in-process Fastify с реальным `registerChatCompletionsRoute`, реальным key store и реальной evidence store).
Доказательство: `screenshots/flows/b2-gateway-dispatch/capture.txt` + `evidence-records/evidence.jsonl`.

Зафиксировано в прогоне:
- verified actor: `api:key_1788692447540_356490e0` (kind api, role public) — payload `apiKeyId` в `ide.gateway.request.received`
- real DispatchPlan: status=planned, capability `cap.model.demo_reply` (kind model, trust core), binding `provider_bridge` → `kilo_mcp` (requires_provider), availability online, provider `local:llm` score 106, authorization allow (run_agent)
- real executor invocation: `DemoReplyExecutor` (route `provider_bridge`), вход в evidence `dispatch_started`/`execution_started`
- real output: `Tele•GPT говорит: Capstone authenticated dispatch` (HTTP 200 body capture.txt:7-22)
- real evidence chain: intent_classified → provider_policy_checked → provider_candidates_scored → provider_decision_created (score 106) → dispatch_started → execution_started → execution_finished=completed
- response contract: OpenAI `chat.completion`, id local-demo, model local-demo, choices[0].message.content
- no duplicate execution: `ide.gateway.execution.*` = 0 (capture.txt:33-34)

Честность ограничения: это изолированный интеграционный прогон production-модулей через Fastify-in-process, **не** boot полного `server/index.ts` (отдельный порт `/health` `/ready`).
Полный server-boot прогон: **NOT-EXERCISED**.

## 11. Files
```
src/gateway/dispatch-adapter.ts          GatewayDispatchAdapter (trusted actor + dispatchDemoReply + error mapping)
src/gateway/routes/chat-completions.ts   demo-slice ветка (dispatch only, single lifecycle), err.errorType override
tests/unit/gateway/gatewayDispatch.test.ts  B2 acceptance suite (proof: dispatch, auth gates, legacy isolation)
```

Supporting acceptance evidence (записаны из реальных прогонов, не заменяют тесты):
```
screenshots/flows/b2-gateway-dispatch/capture.txt            Что доказывает: живой isolated run — HTTP 200 demo, HTTP 401 no-auth, legacy seam, duplicate-exec=0
screenshots/flows/b2-gateway-dispatch/evidence-records/evidence.jsonl  Что доказывает: реальная canonical evidence chain из runs (intent→provider→dispatch→execution_finished=completed)
screenshots/flows/b2-gateway-dispatch/test-run.txt           Что доказывает: точные результаты всех suite из §9 (7/7, 20/20, 5/5, 14/14, 16/16, E2E PASS, tsc 0)
```

`capture.txt`/`evidence-records/evidence.jsonl` — записанный вывод реальных исполнений (текст, т.к. у API-surface миграции нет рендеримого UI для PNG-скриншота; требование «скрин = supporting evidence, не замена тестам» соблюдено).

Commit:
`115b1d0`

## 12. Boundaries held
- routeChat untouched
- ChatRequest untouched
- Provider OS untouched
- Availability untouched
- CapabilityRegistry untouched
- Auth/AuthZ semantics untouched
- Evidence schema untouched
- server/index untouched
- Telegram/Kilo untouched
- Browser OS untouched

## 13. Deferred
Остальные B1 candidates остаются legacy/deferred:

- routeChat full migration
- llmFallback / policyRouter
- callCreatorStable
- Forge Bridge execution
- Workers execution
- replay execution
- Telegram/Kilo
- Browser OS

## 14. Acceptance decision

B2 criteria:
Trusted identity       ✅
Dispatch production use ✅
Legacy XOR Dispatch    ✅
Evidence single-life   ✅
Gateway compatibility  ✅
Security               ✅
Tests                   ✅
Full tsc                ✅

> PD-W3/B2 — LOCKED 🔒

## 15. Next
Do NOT jump straight into full routeChat migration.

Recommended:
PD-W3/B3 — Forge + Worker Execution Surface Migration Gate

First audit whether Forge and Worker execution should share one
ExecutionRouteRegistry pattern or remain two executor domains.

No auto-start.