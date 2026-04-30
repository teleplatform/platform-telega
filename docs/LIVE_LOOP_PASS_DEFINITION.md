
# Live Loop PASS Definition

`artifact_id`: live_loop_pass_definition  
`status`: FIXED  
`classification`: Client Zero → Pass Criteria  
`owner`: Tele•GPT Core  
`observed_at`: 2026-02-24  

---

## 1) PASS Definition (Жёстко)

### 1.1 API Contracts (Все 4 endpoint работают)

#### A. POST /v1/agent/run
- ✅ Возвращает sid (идентификатор сессии)
- ✅ Возвращает links: { stream, status, evidence_verify }
- ✅ Возвращает evidence: { bundle_ref, bundle_hash }
- ✅ bundle_ref появляется только после completion

#### B. GET /v1/agent/stream?sid=...
- ✅ Content-Type: text/event-stream
- ✅ id соответствует eid trace-события
- ✅ event: trace (фиксированный тип)
- ✅ data: полный JSON trace event после redaction
- ✅ Late join: подключился позже → replay всех событий → потом live
- ✅ Порядок монотонный (по ts)

#### C. GET /v1/agent/status?sid=...
- ✅ Возвращает state (из AgentSession)
- ✅ Возвращает last_eid (чтобы Forge понял "догнал ли стрим")
- ✅ Возвращает bundle_ref (если уже собран)
- ✅ Возвращает timestamps (created/updated/started/completed/failed/terminated)

#### D. POST /v1/evidence/verify
- ✅ Проверяет цепочку prev_hash → hash у trace events
- ✅ Проверяет все файлы, заявленные в manifest
- ✅ Проверяет, что bundle_hash совпадает с тем, что реально на диске/в сторе
- ✅ Проверяет размеры/лимиты
- ✅ Возвращает verified: true/false
- ✅ Возвращает checks: { manifest, hash, trace, files }
- ✅ Возвращает violations: [] (если есть проблемы)

---

### 1.2 Live Loop (End-to-End)

#### Шаг 1: Run
```
Forge → POST /v1/agent/run
Tele•GPT → { ok, sid, links, evidence }
```

#### Шаг 2: Stream
```
Forge → GET /v1/agent/stream?sid=...
Tele•GPT → SSE: session.created → ... → session.completed
```

**Требования:**
- session.created — первое событие
- session.completed или session.failed — последнее
- Все события лежат в trace.jsonl
- Порядок монотонный

#### Шаг 3: Verify
```
Forge → POST /v1/evidence/verify { bundle_ref }
Tele•GPT → { ok, verified, checks, violations }
```

**Требования:**
- verified: true
- checks: { manifest: true, hash: true, trace: true, files: true }
- violations: []
- bundle_hash стабилен (повторный вызов даёт PASS)

---

### 1.3 Trace-First (Без "вне-трейсовых" данных)

- ✅ Всё, что UI показывает, идёт только из trace
- ✅ Никаких данных, которые не записаны в trace.jsonl
- ✅ SSE стримит только то, что уже записано в trace

---

## 2) FAIL Definition (Любое нарушение)

### 2.1 API Contracts
- ❌ POST /v1/agent/run не возвращает sid/links/evidence
- ❌ GET /v1/agent/stream не имеет правильных headers
- ❌ GET /v1/agent/stream не имеет id/event/data
- ❌ GET /v1/agent/stream не поддерживает late join
- ❌ GET /v1/agent/status не возвращает last_eid/bundle_ref
- ❌ POST /v1/evidence/verify не проверяет chain/manifest/files

### 2.2 Live Loop
- ❌ session.created не первое событие
- ❌ session.completed/failed не последнее событие
- ❌ События не лежат в trace.jsonl
- ❌ Порядок не монотонный
- ❌ verify не проходит
- ❌ bundle_hash не стабилен

### 2.3 Trace-First
- ❌ UI показывает данные, которых нет в trace
- ❌ SSE стримит данные, которых нет в trace

---

## 3) Smoke Test (Критерий PASS)

### 3.1 Test 1: Run agent
```bash
curl -X POST http://localhost:8787/v1/agent/run   -H "Content-Type: application/json"   -d '{
    "input": {
      "task": "Test task for live loop",
      "messages": [{ "role": "user", "content": "Hello" }]
    },
    "options": {
      "model": "openai:gpt-4o-mini",
      "reply_mode": "forge",
      "tools": { "fs_read": false, "net_fetch": false }
    }
  }'
```

**PASS если:**
- ok: true
- sid: sid_01H...
- links: { stream, status, evidence_verify }
- evidence: { bundle_ref, bundle_hash }

### 3.2 Test 2: Stream events
```bash
curl -N http://localhost:8787/v1/agent/stream?sid=sid_01H...
```

**PASS если:**
- Content-Type: text/event-stream
- event: trace
- id: evt_01H...
- data: { ... }
- session.created → ... → session.completed
- Все события в trace.jsonl

### 3.3 Test 3: Verify evidence
```bash
curl -X POST http://localhost:8787/v1/evidence/verify   -H "Content-Type: application/json"   -d '{
    "bundle_ref": "evidence://sid_01H.../bundle"
  }'
```

**PASS если:**
- ok: true
- verified: true
- checks: { manifest: true, hash: true, trace: true, files: true }
- violations: []

### 3.4 Test 4: Status endpoint
```bash
curl http://localhost:8787/v1/agent/status?sid=sid_01H...
```

**PASS если:**
- ok: true
- state: completed
- last_eid: evt_01H...
- bundle_ref: evidence://sid_01H.../bundle

---

## 4) Final Verdict

**PASS если:**
- ✅ Все 4 API endpoint работают по контракту
- ✅ Live loop замкнут (Run → Stream → Verify)
- ✅ Trace-first соблюдён
- ✅ bundle_hash стабилен
- ✅ verify проходит

**FAIL если:**
- ❌ Любое нарушение контракта API
- ❌ Live loop не замкнут
- ❌ Trace-first нарушен
- ❌ bundle_hash не стабилен
- ❌ verify не проходит

---

## 5) Smoke Test Script

**PASS если:**
- Код выхода: 0
- Все тесты PASS

**FAIL если:**
- Код выхода: 1
- Любой тест FAIL

---

**Tele•GPT v1 — Live Loop PASS Definition зафиксирован.** ✅
