
# PACK v1.6 — STREAMING (SSE)

`artifact_id`: pack_v1_6_streaming_sse  
`status`: FIXED  
`classification`: Pack → Runtime Observability  
`owner`: Tele•Ga Core  
`applies_to`: Tele•GPT Runtime, Sigma Forge Harness  
`depends_on`:
  - canon_spec_trace_layer_minimum_v1
  - pack_v1_5_tool_calls_readonly
  - canon_interpretation_agent_runtime_patterns_v1  
`fixed_at`: 2026-02-24

---

## 1. Goal (жёстко)

Сделать Agent Runtime наблюдаемым в реальном времени, так чтобы:
- человек видит живое выполнение, а не "ответ в конце",
- runtime может быть использован как терминал агента,
- streaming является проекцией trace, а не отдельной логикой,
- streaming не ломает replay / audit / evidence.

**Core Principle:**
> Streaming — это не UX-фича. Streaming — это транспорт trace в реальном времени.

---

## 2. Scope (минимум, без разрастания)

В Pack v1.6 входит только:
- Server-Sent Events (SSE)
- поток trace-derived событий
- read-only, без управления агентом
- единый streaming-endpoint

❌ Не входит:
- WebSockets
- bidirectional control
- approvals
- tool execution
- UI-логика

---

## 3. Canonical Streaming Model

### 3.1 Источник истины

Единственный источник для streaming — Trace Layer.

Streaming:
- НЕ генерирует новые события
- НЕ имеет собственной модели данных
- НЕ "форматирует логи"

Он ретранслирует trace-events, уже прошедшие policy + redaction.

---

## 4. Transport Protocol

### 4.1 Protocol

- SSE (Server-Sent Events)
- HTTP/1.1 compatible
- Content-Type: text/event-stream
- UTF-8
- One event per SSE message

### 4.2 Endpoint (canonical)

```
GET /v1/agent/stream?sid=<AgentSessionId>
```

Headers:
```
Accept: text/event-stream
Cache-Control: no-cache
```

---

## 5. SSE Event Envelope (Streaming Contract)

Каждое SSE-сообщение содержит ровно один trace-event.

```
event: trace
id: evt_01H...
data: { ...trace_event_json... }
```

Rules:
- id = eid из trace
- data = полный JSON trace-event (как в trace.jsonl)
- порядок = порядок записи в trace

---

## 6. Required Streamed Event Types (v1)

Минимально обязательные для стрима:

### Session
- session.created
- session.state_changed
- session.completed
- session.failed

### Planning / Steps
- plan.created
- step.started
- step.finished

### Policy
- policy.checked
- policy.denied

### Tools (read-only, from Pack v1.5)
- tool.called
- tool.result

### Evidence
- evidence.artifact_written
- evidence.bundle_finalized

---

## 7. Ordering & Consistency Guarantees

Streaming MUST guarantee:
- Monotonic ordering (no reordering)
- No missing events (once streamed, must exist in trace.jsonl)
- No speculative events (only committed trace entries)
- Late join supported

### 7.1 Late Join Rule

If client connects after session started:
- runtime MUST replay all existing trace events for sid
- then continue live streaming

This ensures:
- stateless clients
- resumable observation
- replay-equivalence

---

## 8. Backpressure & Disconnect Semantics

### 8.1 Client disconnect

- streaming stops
- agent execution CONTINUES
- trace recording CONTINUES

### 8.2 Reconnect

- client reconnects with same sid
- server replays missing events

Streaming never controls execution.

---

## 9. Security & Isolation

Streaming is read-only:
- No control channel
- No side effects

AuthZ must ensure:
- caller is allowed to observe sid
- Redaction rules from Pack v1.5 apply before streaming

---

## 10. Relation to UI Layers

UI (Telegram / Web / IDE):
- consumes SSE
- renders events
- may collapse / prettify / group

But:
> UI NEVER invents semantics. UI only projects what trace already knows.

---

## 11. Validity Tests (Must Pass)

Runtime is Pack v1.6 compliant if:
- /v1/agent/stream exists
- SSE stream delivers trace events
- every streamed event exists verbatim in trace.jsonl
- order matches trace order
- late join replays full history
- no tool execution can be triggered via stream

Fail any → non-compliant runtime.

---

## 12. Canon Verdict

**VERDICT:**  
CONFIRMED — Streaming (SSE) is canonically fixed as:
- Real-time projection of Trace Layer, not a UI feature

**DECISION:**  
Mandatory for any runtime claiming "agent runtime as terminal".

**ACTION:**  
No implementation forced by canon itself.

---

## Status After Pack v1.6

✅ AgentSession Lifecycle  
✅ Trace Layer Minimum  
✅ Tool Calls Read-Only  
✅ Streaming (SSE)  
🛑 Agent Runner ещё не определён  
🛑 Evidence Bundle ещё не замкнут

---

## Next Step (СТРОГО ПО ПОРЯДКУ)

🔜 Pack v1.7 — Agent Runner v1 (Minimal)

Там мы впервые:
- зафиксируем реальные состояния AgentSession,
- определим state machine + transitions,
- свяжем lifecycle ↔ trace ↔ streaming.
