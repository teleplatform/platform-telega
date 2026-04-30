
# PACK v1.7 — Agent Runner v1 (Minimal, Lifecycle-bound)

`artifact_id`: pack_v1_7_agent_runner_minimal  
`status`: FIXED  
`classification`: Pack → Runtime Kernel → Execution Semantics  
`owner`: Tele•Ga Core  
`applies_to`: Tele•GPT Runtime (primary), Sigma Forge Harness (consumer/driver)  
`depends_on`:
  - canon_spec_trace_layer_minimum_v1
  - pack_v1_5_tool_calls_readonly
  - pack_v1_6_streaming_sse
  - canon_spec_agentsession_lifecycle_v1  
`fixed_at`: 2026-02-24

---

## 1. Goal (Hard)

Define the minimal valid Agent Runner for Tele•Ga:
- executes an AgentSession as a long-living process
- drives state machine transitions (lifecycle-bound)
- emits Trace events (Trace Layer Minimum compliant)
- supports Tool Calls Read-Only (net.fetch allowlist, fs.read sandbox)
- is observable via SSE streaming (trace projection)
- produces a deterministic end state: completed / failed / terminated

**Core Principle:**
> Agent Runner is not "chat with tools". Agent Runner is a contract-bound runtime process.

---

## 2. Scope (Minimal)

### In scope (v1)
- session state machine + transitions
- plan → steps execution loop
- read-only tool calls (Pack v1.5)
- trace emission (Canon Trace Minimum)
- streaming compatibility (Pack v1.6)
- cancellation / termination signal (safe stop)

### Out of scope
- parallel sub-agents
- write-capable tools
- automatic approvals
- background schedules / cron
- advanced memory / compaction strategies
- multimodal IO

---

## 3. Runtime Model (Objects)

### 3.1 AgentSession (runtime instance)

Fields (conceptual):
```
sid              session id
rid              run/request id
state            lifecycle state
policy_profile   (which rules apply)
plan             (steps)
step_cursor      (current step index)
tools            (allowed: net.fetch, fs.read)
created_at, updated_at
terminal         (completed/failed/terminated details)
```

### 3.2 Plan (minimal)

A plan is a finite ordered list of steps.

Each step has:
- step_id
- title
- intent (string, optional)
- inputs (object, optional)
- expected_artifacts (array, optional)

---

## 4. State Machine (Canonical)

### 4.1 States (v1)

Allowed states:
- created
- planning
- running
- waiting_approval (reserved; v1 runner does not auto-enter, but MUST support representation for future)
- completed (terminal)
- failed (terminal)
- terminated (terminal)

### 4.2 Allowed transitions

```
created → planning
planning → running
running → completed
running → failed
created|planning|running → terminated
waiting_approval → running (reserved)
waiting_approval → terminated (reserved)
```

Any other transition is INVALID and MUST be traced as policy violation / runtime error.

---

## 5. Execution Semantics (Step Loop)

### 5.1 Canonical loop

1. Create session
   - emit: session.created
   - set: state=created

2. Enter planning
   - transition created → planning
   - emit: session.state_changed
   - generate plan (minimal: steps list)
   - emit: plan.created

3. Enter running
   - transition planning → running
   - emit: session.state_changed

4. Execute steps sequentially
   For each step:
   - emit: step.started
   - perform reasoning (model call) to produce an action proposal
   - if proposal includes tool usage:
     - run policy checks
     - execute only allowed read-only tools
     - trace: tool.called + tool.result
   - emit: step.finished with ok=true|false

5. Terminal
   - if all steps ok: running → completed
     - emit: session.completed
   - if any step fails fatally: running → failed
     - emit: session.failed
   - if stop requested: → terminated
     - emit: session.terminated

Important rule: Runner MUST NOT "skip" step tracing even if model returns instantly.

---

## 6. Tool Use (Read-Only Compliance)

Agent Runner v1 may execute tool calls only via the Tool Gateway defined in Pack v1.5.

### Allowed tools
- net.fetch (https only, allowlist domains)
- fs.read (sandbox dirs only)

### Mandatory trace
Every tool call MUST produce:
- policy.checked (before execution)
- tool.called
- tool.result

If denied:
- emit policy.denied
- tool execution MUST NOT occur

---

## 7. Cancellation / Termination (Safe Stop)

### 7.1 Stop signal

Runner MUST support an external stop signal:
```
POST /v1/agent/terminate?sid=...
```
(endpoint name is an implementation detail; capability is mandatory)

Semantics:
- stop is best-effort and safe
- current step may finish, but runner must move to terminal state quickly
- trace MUST record:
  - session.terminated
  - session.state_changed to terminated (if using explicit)

---

## 8. Streaming Compatibility (Pack v1.6)

Runner emits trace events; streaming is a projection.

Required:
- as runner writes trace.jsonl, SSE stream forwards events live
- late join can replay full session history

Runner MUST NOT depend on streaming availability.

---

## 9. Minimal API Surface (Runtime Kernel)

These endpoints are the minimal external surface expected by consumers:

### 9.1 Start run (creates session and runs)

```
POST /v1/agent/run
```

Input (minimal):
```json
{
  "rid": "req_...",
  "task": {
    "text": "…"
  },
  "policy_profile": "default",
  "tool_budget": {
    "net_fetch": 10,
    "fs_read": 50
  }
}
```

Output (minimal):
```json
{
  "sid": "sess_...",
  "state": "running",
  "stream": {
    "sse": "/v1/agent/stream?sid=sess_..."
  }
}
```

### 9.2 Read status

```
GET /v1/agent/status?sid=...
```

Output:
```json
{
  "sid": "sess_...",
  "state": "running",
  "step": {
    "current": 2,
    "total": 7
  },
  "trace": {
    "latest_eid": "evt_..."
  }
}
```

### 9.3 Stream (SSE)

```
GET /v1/agent/stream?sid=...
```
(defined in Pack v1.6)

### 9.4 Terminate (safe stop)

```
POST /v1/agent/terminate?sid=...
```

Output:
```json
{
  "sid": "sess_...",
  "state": "terminated"
}
```

---

## 10. Validity Tests (Must Pass)

Runner is v1.7-compliant if:
- State machine transitions follow section 4 only
- Trace contains required events from Trace Minimum
- Every step produces step.started + step.finished
- Tool calls are read-only and gated by policy checks
- Termination is possible and yields terminal trace event
- SSE projection shows the same events in the same order (late join works)

Fail any → runtime is non-compliant.

---

## 11. Canon Verdict

**VERDICT:**  
CONFIRMED — Agent Runner v1 defines the minimal valid runtime kernel for Tele•Ga.

**DECISION:**  
Any "agent" implementation without:
- lifecycle-bound states,
- step loop,
- tool policy gates,
- trace-first observability

is not a Tele•Ga agent runtime.

**ACTION:**  
No implementation forced by canon alone.

---

## Status After v1.7

✅ AgentSession Lifecycle  
✅ Trace Layer Minimum  
✅ Tool Calls Read-Only  
✅ Streaming (SSE)  
✅ Agent Runner v1 (Minimal)  
🔜 Pack v1.8 — Evidence Bundle v1 (финальная замкнутость)

---

## Next Step (СТРОГО ПО ПОРЯДКУ)

🔜 Pack v1.8 — Evidence Bundle v1

Там мы:
- фиксируем структуру evidence/
- "запечатываем" trace + artifacts в один bundle
- формально определяем bundle_hash и verify процедуру
