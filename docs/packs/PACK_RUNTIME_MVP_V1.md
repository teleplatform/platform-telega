
# PACK: Tele•GPT Runtime MVP v1 (First Live Closed Loop)

`artifact_id`: pack_runtime_mvp_v1  
`status`: FIXED  
`classification`: Pack → Implementation Blueprint  
`owner`: Tele•GPT Core  
`observed_at`: 2026-02-24  
`depends_on`:
- PACK_V1_5_TOOL_CALLS_READONLY
- PACK_V1_6_STREAMING_SSE
- PACK_V1_7_AGENT_RUNNER_V1
- PACK_V1_8_EVIDENCE_BUNDLE_V1
- AUDIT_RUNTIME_CLOSURE_v1

---

## 1. Goal (Hard)

Ship the first live Tele•GPT runtime loop where one AgentSession can be:
- started via a single API call
- executed by AgentRunner
- fully traced
- observable via SSE (replay + live)
- sealed into an Evidence Bundle
- verifiable via verify() procedure

No UI assumptions. No write/exec tools. No side effects.

---

## 2. Scope (Strict)

### 2.1 In-scope (MVP v1)

- Exactly 1 AgentSession per run
- Exactly 1 AgentRunner implementation
- Tools: read-only only
  - fs.read (sandbox) ✅
  - net.fetch (allowlist) ✅
- Streaming: SSE using trace as source of truth ✅
- Evidence Bundle: seal + verify ✅
- Response: minimal but contract-grade

### 2.2 Out of scope (explicitly)

- Tool writes (fs.write, terminal.exec, etc.)
- Human approvals / interactive control channel
- Multi-agent spawn
- Complex planning orchestration
- Provider economics, quota, billing (this is v2.x)
- Persistence/resume across restarts (later)

---

## 3. One Live Workflow (Canonical)

Single request: `POST /v1/agent/run`

Creates an AgentSession, runs it, emits trace, seals evidence, returns final result.

Parallel observation: `GET /v1/agent/stream?sid=...`

SSE stream replays all existing trace events, then continues live.

**Invariant**: Everything the client sees must be reconstructible from trace.jsonl. Streaming never invents events.

---

## 4. Minimal API Surface (MVP)

### 4.1 POST /v1/agent/run

**Input (minimal):**
```json
{
  "input": {
    "messages": [
      { "role": "user", "content": "..." }
    ]
  },
  "options": {
    "model": "openai:gpt-4o-mini",
    "tools": {
      "fs_read": true,
      "net_fetch": false
    }
  }
}
```

**Output:**
```json
{
  "ok": true,
  "sid": "sid_01H...",
  "status": "completed",
  "result": {
    "assistant_message": { "role": "assistant", "content": "..." }
  },
  "evidence": {
    "bundle_ref": "evidence://sid_01H.../bundle",
    "bundle_hash": "sha256:...",
    "verify": {
      "procedure": "POST /v1/evidence/verify",
      "expected_ok": true
    }
  }
}
```

**Error contract**: MUST use existing production error schema already in Tele•GPT.

### 4.2 GET /v1/agent/stream?sid=...

SSE stream with `event: trace` envelope where `data` is a trace event JSON.

**Rules:**
- replay all existing events for sid, then live tail
- ordering monotonic (trace order)
- authz: only allowed observers can stream
- read-only, no control channel

### 4.3 POST /v1/evidence/verify

**Input:**
```json
{ "bundle_ref": "evidence://sid_..." }
```

**Output:**
```json
{
  "ok": true,
  "bundle_hash": "sha256:...",
  "verified": true,
  "checks": ["manifest", "hash", "trace"]
}
```

---

## 5. Runtime Ownership (Non-negotiable)

- AgentSession lifecycle owned by Tele•GPT Kernel
- Trace writing owned by Tele•GPT Trace Layer
- Tool calls always go through policy gates (v1.5)
- Evidence sealing owned by Tele•GPT Evidence module
- SSE reads from trace only (v1.6)
- UI layers (Telegram/Web/IDE) are consumers only.

---

## 6. Required Trace Events (MVP Minimum)

MVP MUST emit at least:

**Session:**
- session.created
- session.state_changed (created → running → completed/failed)
- session.completed OR session.failed

**Plan/Step (minimal single-step allowed):**
- plan.created (can be 1-step plan)
- step.started
- step.finished

**Tool boundary (if used):**
- policy.checked
- tool.called
- tool.result

**Evidence:**
- evidence.artifact_written (trace + at least 1 artifact)
- evidence.bundle_finalized

**Invariant**: every state transition has a corresponding trace event.

---

## 7. Evidence Bundle Layout (MVP)

For a given sid, evidence directory:

```
evidence/<sid>/
  trace.jsonl
  artifacts/
    assistant_message.json
    run_result.json
  manifest.json
  bundle_hash.txt
```

**Seal rules:**
- bundle_hash = SHA-256 over deterministic ordered file list (see v1.8)
- manifest includes:
  - sid
  - created_at
  - file list + per-file hashes
  - redaction summary (if any)
  - tool policy summary (if any)

---

## 8. Implementation Plan (Commit-ready)

### 8.1 Files to add/modify (suggested map)

**New files:**
- `src/types/agentRuntime.ts` - Runtime types
- `src/core/agent/runtime/agentSession.ts` - Session lifecycle
- `src/core/agent/runtime/traceWriter.ts` - Trace writer
- `src/core/agent/runtime/policyGate.ts` - Tool policy gate
- `src/core/agent/runtime/evidence/seal.ts` - Evidence sealer
- `src/core/agent/runtime/evidence/verify.ts` - Evidence verifier
- `src/core/agent/runtime/agentRunner.ts` - Agent runner
- `src/server/routes/agent.route.ts` - Agent API routes
- `scripts/smoke-agent-mvp-v1.sh` - Smoke tests

**Modified files:**
- `src/server/index.ts` - Register agent route

### 8.2 Minimal Runner behavior (v1)

AgentRunner may be "single-turn":
- take input messages
- call provider once to produce assistant_message
- optionally call read-only tools if explicitly requested by runner plan (but still policy-gated)

**Important**: even if runner is minimal, lifecycle + trace + evidence must still be complete.

---

## 9. Done Definition (MVP Acceptance)

MVP is DONE when:
- POST /v1/agent/run returns ok:true and sid
- GET /v1/agent/stream?sid= replays session trace and streams live updates
- evidence/<sid>/trace.jsonl exists and contains required minimum events
- evidence bundle is sealed with bundle_hash
- POST /v1/evidence/verify returns verified:true for the produced bundle
- tool calls (if any) are strictly read-only and policy-checked

---

## 10. Validity Tests (Must pass)

### Smoke Test A: "No tools"
- run agent with a simple prompt
- verify trace has lifecycle + plan/step + evidence events
- verify bundle passes verify()

### Smoke Test B: "fs.read allowed"
- provide a file within sandbox
- runner requests fs.read
- verify policy.checked + tool.called/result in trace
- verify evidence includes artifact(s) referencing output
- verify bundle passes verify()

### Smoke Test C: "net.fetch denied"
- runner attempts net.fetch outside allowlist (or disabled tools)
- expect policy.denied and session.failed (or completed with tool denied handled)
- verify trace records denial
- verify bundle still sealed (even for failure)

---

## 11. Canon Verdict

**VERDICT**: CONFIRMED — this pack activates the already-fixed canon into a first live, verifiable runtime loop.

**DECISION**: No new canon. Only productization of existing contracts.

**ACTION**: Implement exactly this MVP, then proceed to the next pack by order:
- PACK_FORGE_HANDSHAKE_V1.md (Sigma Forge ↔ Tele•GPT wiring)
