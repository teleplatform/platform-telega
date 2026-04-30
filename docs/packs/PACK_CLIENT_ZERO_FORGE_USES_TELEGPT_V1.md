
# PACK: Client Zero • Forge uses Tele•GPT v1

`artifact_id`: pack_client_zero_forge_uses_telegpt_v1  
`status`: FIXED  
`classification`: Pack → Client Integration Specification  
`owner`: Tele•GPT Core  
`observed_at`: 2026-02-24  
`depends_on`:
- PACK_RUNTIME_MVP_V1
- PACK_FORGE_HANDSHAKE_V1
- TELEGPT_READY_DEFINITION_V1

---

## 1) Goal (Hard)

Сделать Sigma Forge первым живым клиентом Tele•GPT, где любая задача = один sid, один стрим, один evidence verdict.

**Definition of Done:**
- Forge умеет отправить BuildTask → Tele•GPT /v1/agent/run
- Forge UI/CLI умеет открыть стрим /v1/agent/stream?sid=...
- По завершении Forge забирает bundle_ref и запускает /v1/evidence/verify
- Результат показывается человеку как: status + diff + evidence verdict (без магии)

---

## 2) Canonical Ownership (Без двусмысленности)

### 2.1 Tele•GPT владеет:
- lifecycle (AgentSession)
- trace (trace.jsonl)
- policy (Policy Gate)
- evidence seal (EvidenceBundle)
- verify truth (verify() procedure)

### 2.2 S•F владеет:
- UX (UI/CLI projection)
- постановка задач (BuildTask/Intent)
- worktree/локальный sandbox
- "принять/отклонить"
- PR/commit flow

**Правило**: Forge ничего "не придумывает". Он проецирует то, что уже истинно в trace.

---

## 3) Live Loop (Минимум, без роскоши)

1. Forge создаёт задачу (BuildTask/Intent)
2. Tele•GPT стартует AgentSession → возвращает sid
3. Forge подписывается на SSE и показывает ход выполнения
4. Tele•GPT завершает и отдаёт bundle_ref
5. Forge вызывает verify и показывает вердикт

---

## 4) Контракты (Тонкий слой, без усложнения)

### 4.1 Start

**POST /v1/agent/run**

**Request (минимум):**
```json
{
  "input": {
    "task": "Fix bug in authentication module",
    "context_refs": [
      {
        "kind": "repo",
        "remote": "https://github.com/org/repo",
        "ref": "main",
        "commit": "abc123"
      },
      {
        "kind": "artifact",
        "path": "/workspace/docs/bug-report.md"
      }
    ]
  },
  "options": {
    "model": "openai:gpt-4o-mini",
    "reply_mode": "forge",
    "tools": {
      "fs_read": true,
      "net_fetch": true
    }
  },
  "forge": {
    "workspace": {
      "kind": "worktree",
      "root": "/workspace",
      "allow_paths": ["/workspace/docs", "/workspace/src"],
      "deny_paths": ["/workspace/.git", "/workspace/node_modules"]
    },
    "tool_proxy": {
      "base_url": "http://forge-toolproxy:7777",
      "auth": {
        "type": "bearer",
        "token": "forge_ephemeral_token"
      }
    }
  }
}
```

**Response:**
```json
{
  "ok": true,
  "sid": "sid_01H...",
  "stream_url": "/v1/agent/stream?sid=sid_01H...",
  "status_url": "/v1/agent/status?sid=sid_01H...",
  "expected_artifacts": ["assistant_message.json", "diff.patch"]
}
```

### 4.2 Stream

**GET /v1/agent/stream?sid=...** (SSE)

**События:**
- session.* (created, state_changed, completed/failed)
- plan.* (created)
- step.* (started, finished)
- tool.* (called, result)
- policy.* (checked, denied, allowed)
- evidence.* (artifact_written, bundle_finalized)

**Пример события:**
```
event: trace
id: evt_01H...
data: {
  "v": 1,
  "ts": "2026-02-24T00:00:00Z",
  "rid": "rid_01H...",
  "sid": "sid_01H...",
  "eid": "evt_01H...",
  "type": "step.started",
  "lvl": "info",
  "actor": { "kind": "agent", "id": "runner" },
  "span": { "span_id": "sp_01H...", "parent_span_id": null },
  "data": {
    "step_id": "step_01H...",
    "title": "Read documentation",
    "intent": "Understand bug report"
  }
}
```

### 4.3 Verify

**POST /v1/evidence/verify**

**Request:**
```json
{
  "bundle_ref": "evidence://sid_01H.../bundle"
}
```

**Response:**
```json
{
  "ok": true,
  "bundle_hash": "sha256:...",
  "verified": true,
  "checks": {
    "manifest": true,
    "hash": true,
    "trace": true,
    "files": true
  },
  "violations": []
}
```

---

## 5) ToolProxy (Как "руки" Forge подключаются без риска)

Tele•GPT не ходит в терминал/файлы напрямую. Он делает запросы "к рукам" через ToolProxy (Forge Gateway), а Forge возвращает результаты.

**Минимальный набор для Client Zero:**
- fs.read (sandbox)
- net.fetch (allowlist)
- (опционально позже) terminal.exec — но НЕ в первом live loop, если хочешь железобетонно безопасно

**ToolProxy Contract (из PACK_FORGE_HANDSHAKE_V1):**

**Request:**
```json
{
  "sid": "sid_01H...",
  "call_id": "toolcall_01H...",
  "kind": "fs.read",
  "args": {
    "path": "/workspace/docs/README.md",
    "max_bytes": 1048576
  },
  "tele_gpt_policy": {
    "policy_id": "fs_read_sandbox",
    "decision": "allow",
    "decision_hash": "sha256:...",
    "issued_at": "2026-02-24T00:00:00Z",
    "sig": "ed25519:..."
  }
}
```

**Response:**
```json
{
  "ok": true,
  "call_id": "toolcall_01H...",
  "result": {
    "content_base64": "...",
    "bytes": 1234
  },
  "meta": {
    "elapsed_ms": 42
  }
}
```

---

## 6) UX в Sigma Forge (Самое важное для ощущения "живого")

### 6.1 Экран "Mission Run"

**Верхняя часть:**
- sid
- статус (Running/Done/Failed)
- прогресс (шаги из trace)

**Центральная часть:**
- лента событий (SSE), сгруппированная по шагам
- для каждого шага:
  - title
  - intent
  - tool calls (если есть)
  - artifacts (если есть)

**Нижняя часть:**
- "Artifacts" (diff.patch, tests.report, manifest.json, seal.json)
- кнопка: "Verify Evidence"
- вердикт: PASS/FAIL + причины

**Правило**: Никаких "чатов" как помойки. Одна миссия = одна лента = один bundle.

---

## 7) Smoke Tests (Чтобы это считалось реально живым)

### Test A — "Forge → Tele•GPT → SSE → Verify"

1. Forge → POST /v1/agent/run → получил sid
2. Forge открыл SSE → увидел session.created
3. Tele•GPT дошёл до session.completed
4. Forge получил bundle_ref
5. Forge сделал POST /v1/evidence/verify → PASS

**Если эти 5 пунктов выполняются — Client Zero live loop готов.**

### Test B — "Tool Call via ToolProxy"

1. Forge создаёт workspace с документацией
2. Forge запускает задачу "Read documentation"
3. Tele•GPT вызывает fs.read через ToolProxy
4. Trace показывает policy.checked → tool.called → tool.result
5. Forge видит результат в SSE
6. Evidence bundle включает artifact с содержимым файла

### Test C — "Policy Denial"

1. Forge запускает задачу, требующую чтения запрещённого файла
2. Tele•GPT вызывает policy gate → deny
3. Trace показывает policy.denied
4. Session завершается с failed
5. Evidence bundle всё равно sealed
6. Verify возвращает PASS (bundle корректен, даже если задача не удалась)

---

## 8) Implementation Plan

### 8.1 Files to add/modify (Tele•GPT side)

**New files:**
- `src/types/forgeClient.ts` - Forge client types
- `src/server/routes/forgeClient.route.ts` - Forge client endpoints

**Modified files:**
- `src/server/routes/agent.route.ts` - Add reply_mode support
- `src/core/agent/runtime/agentRunner.ts` - Integrate with ToolProxy

### 8.2 Files to add/modify (Forge side)

**New files:**
- `src/forge/teleGptClient.ts` - Tele•GPT client
- `src/forge/ui/MissionRun.tsx` - Mission Run UI
- `src/forge/cli/stream.ts` - CLI streaming

**Modified files:**
- `src/forge/tasks/BuildTask.ts` - Integrate with Tele•GPT

---

## 9) Done Definition (Client Zero)

Client Zero DONE когда:
- Forge умеет отправить BuildTask → Tele•GPT /v1/agent/run
- Forge UI/CLI умеет открыть стрим /v1/agent/stream?sid=...
- По завершении Forge забирает bundle_ref и запускает /v1/evidence/verify
- Результат показывается человеку как: status + diff + evidence verdict (без магии)
- Smoke tests A, B, C проходят

---

## 10) Canon Verdict

**VERDICT**: CONFIRMED — Client Zero создаёт первый живой контур использования Tele•GPT как runtime kernel.

**DECISION**: Forge становится первым клиентом Tele•GPT, дающим real-world pressure для hardening.

**ACTION**: Implement Client Zero, затем proceed to hardening & performance (Track 3).

---

**Tele•GPT v1 — готов. Forge — первый клиент. Live loop — замкнут.** 🚀
