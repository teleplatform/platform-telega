# Creator Bridge Canon v5

Status: **LOCKED**

## Formula

```
INPUT
→ Strategy
→ Guardrails
→ Execution / Job
→ Evidence
→ Output / Delivery
```

## Stack

| Layer | Version | Description |
|-------|---------|-------------|
| Transport | v1 | CDP + DOM polling |
| Resilience | v2 | Fallback, cooldown, evidence |
| Providers | v3 | 10 web providers |
| Intelligence | v4 | Strategy Engine |
| Guardrails | v4.1 | Schema, allowlist |
| Jobs | v5 | Background execution |

## v1 Transport

- CDP browser execution
- DOM polling via `page.evaluate()` + `waitForFunction()`
- No Playwright locator for streamed output
- Profile-based session isolation

## v2 Resilience

- Fallback chains per provider
- Cooldowns: RATE_LIMIT/OVERLOAD → 10min, EMPTY_OUTPUT → 2min, AUTH → infinite
- Typed error classification
- Persistent evidence JSONL

## v3 Providers

```
chatgpt_web    → default, general
qwen_web       → fast, reasoning
deepseek_web    → logic, code
grok_web       → fast, creative
kimi_web       → long-context
perplexity_web  → research
claude_web    → writing
gemini_web     → vision
poe_web       → aggregator
```

## v4 Intelligence

- Strategy Engine: AI decides execution mode
- Modes: single, research, multi_agent, debate
- Router uses strategy for messages > 100 chars

## v4.1 Guardrails

- Schema validation
- Provider allowlist (9 providers)
- Max 5 steps
- Fallback to rule-based strategy

## v5 Jobs Runtime

- Long tasks execute in background
- Max 2 concurrent jobs
- 10 minute timeout
- Job states: queued → running → waiting_provider → completed/failed/cancelled/timeout

### Job Commands

```
/jobs               → list jobs
/job_status <id>     → job status
/cancel_job <id>     → cancel job
/job_evidence <id>   → job evidence
```

### Job Recovery

- On restart: queued/running → re-queued
- Completed/failed/cancelled → stay final

## Hard Rules

1. `*_web` providers never fallback to API
2. CDP is the only execution path
3. DOM polling is canonical
4. Long multi-agent/debate/research → jobs
5. Evidence is append-only
6. Owner sees all jobs; users see own jobs

## Canon

```
AI decides.
System verifies.
Jobs execute.
Evidence records.
Telegram receives.
```

---

Status: **LOCKED** - Next: v6 Cost/Load Governor