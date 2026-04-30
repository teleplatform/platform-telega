# ASYNC TASK + HITL PROTOCOL CORE R2

**Статус:** `IMPLEMENTATION_SPEC`
**Модуль:** `telega-city/sigma-forge/packages/runtime-task-core`
**Роль:** async-task-core + hitl-protocol + async-delivery-core

---

## Purpose

Async execution + formal human checkpoint для Sigma Forge / Tele•Ga:
- goal как отдельная runtime-сущность (не просто сообщение)
- task lifecycle (queued → planning → running → waiting_human → completed/failed)
- formal human handoff packet с reason codes
- human decisions: approve/edit/reject/reroute/escalate/takeover
- delivery envelope для финальной доставки результата

---

## Architecture

```
Goal
→ Async Task Record
→ Planning / Execution
→ HITL if needed (handoff packet)
→ Human Decision (approve/edit/reject/reroute/escalate/takeover)
→ Resume / Continue / Takeover
→ Final Delivery
```

---

## Modules

| Module | Files |
|--------|-------|
| Async Task Core | taskLifecycle (createAsyncTask, transitions, advance, complete, fail, summary) |
| HITL Protocol | hitlProtocol (handoffTask, resolveHumanDecision, resumeTaskFromDecision, createHumanHandoffPacket) |
| Delivery Core | deliveryCore (createTaskDeliveryEnvelope, resolveDeliveryTargets, canDeliverToTarget, deliverTaskResult) |
| Storage | schema.sql (4 tables: async_tasks, handoffs, human_decisions, task_deliveries), tasksRepo |

---

## Task Lifecycle

| Status | Transitions To |
|--------|---------------|
| queued | planning |
| planning | running, failed |
| running | waiting_human, paused, completed, failed |
| waiting_human | running, cancelled |
| paused | running, failed |
| completed | (terminal) |
| failed | (terminal) |
| cancelled | (terminal) |

---

## Handoff Reason Codes

| Code | When |
|------|------|
| RISK_HIGH | High-risk execution detected |
| APPROVAL_REQUIRED | Policy requires human approval |
| POLICY_BLOCK | Policy blocked execution |
| CONFIDENCE_LOW | Low confidence in output |
| COMMERCIAL_DECISION | Commercial/business decision needed |
| MANUAL_REVIEW_REQUIRED | Manual review required |
| USER_INPUT_REQUIRED | User input needed to continue |

---

## Human Decision Actions

| Action | Result |
|--------|--------|
| approve | → running (continue execution) |
| edit | → running (continue with edits) |
| reject | → cancelled |
| reroute | → planning (reroute task) |
| escalate | → waiting_human (escalate to higher level) |
| takeover | → completed (manual takeover) |

---

## Delivery Targets

telegram, web, miniapp, tgm, max, dashboard

---

## SQLite Schema

- `runtime_async_tasks` — task identity, goal, status, risk, delivery targets
- `runtime_handoffs` — handoff packet with completed steps, blocked reason, risk flags
- `runtime_human_decisions` — human decision with action, notes, replacement output
- `runtime_task_deliveries` — delivery envelope with target, status, payload ref

---

## Definition of Done

- ✅ runtime-task-contracts package
- ✅ runtime-task-core package
- ✅ async-task-core (task lifecycle with valid transitions)
- ✅ hitl-protocol (handoff packet, decision resolver, resume)
- ✅ async-delivery-core (delivery envelopes, target resolution, policy)
- ✅ SQLite schema + repos (4 tables)
- ✅ API facades
- ✅ Unit tests: 31 passed, 0 failed
- ✅ Integration tests: 7 passed, 0 failed
