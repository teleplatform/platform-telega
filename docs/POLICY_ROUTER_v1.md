# Policy Router v1 — Production Core

**Status:** ✅ Canonical (Jan 2026)  
**Location:** `src/core/policyRouter.ts`, `src/core/llmFallback.ts`

## Overview
Policy Router manages LLM request routing through intent detection → lane selection → provider chain → fallback with strict limits and full observability.

## Lane Selection Rules

### Lanes
Three routing lanes with distinct characteristics:

| Lane | Use Case | Max Tokens | Timeout | Priority |
|------|----------|------------|---------|----------|
| `cheap` | Simple FAQ, hours, delivery, booking | 256 | 6s | Fast, low-cost |
| `smart` | Complex questions, comparisons, policies | 768 | 15s | Balanced |
| `coding` | Code fixes, debugging, technical issues | 1200 | 25s | Deep analysis |

### Lane Selection Logic

**Coding Lane** (highest priority)
- Contains keywords: `typescript`, `javascript`, `error:`, `stacktrace`, `build failed`, `syntax error`
- Contains code markers: ` ``` `, `import`, `function`, `const `, `let `
- File extensions: `.ts`, `.js`, `.sql`
- Keywords: `debug`, `fix this code`

**Cheap Lane**
- Intent types: `booking`, `delivery`, `inquiry`, `general`
- Simple questions under 200 characters
- No complex indicators

**Smart Lane** (default for complex queries)
- Contains: `why`, `explain`, `compare`, `difference`, `better`, `recommend`, `should i`, `which one`
- Messages over 200 characters
- Intent types: `buy`, `warranty`, `complaint`
- Fallback for unmatched patterns

## Provider Chains

### Cheap Lane
```
local:deepseek → openai:gpt-4o-mini → local:local-demo
```

### Smart Lane
```
openai:gpt-4o-mini → local:deepseek → local:local-demo
```

### Coding Lane
```
openai:coding-model → local:deepseek → openai:gpt-4o-mini → local:local-demo
```

**Fallback Behavior:**
- Tries each provider in order
- On failure, moves to next in chain
- `local-demo` is guaranteed final fallback
- All failures logged with error classification

## Error Classification

| Error Code | Trigger | Action |
|------------|---------|--------|
| `CONNECTION_ERROR` | Network/DNS failure | Try next provider |
| `TIMEOUT` | Request exceeds lane timeout | Try next provider |
| `AUTH_ERROR` | 401/403 response | Skip provider, try next |
| `RATE_LIMIT` | 429 response | Skip provider, try next |
| `UPSTREAM_ERROR` | Other provider errors | Try next provider |

## Trace Metadata

Every request adds detailed routing metadata:

```json
{
  "lane": "cheap|smart|coding",
  "intent": "buy|inquiry|booking|delivery|warranty|complaint|general",
  "intent_confidence": 0.3,
  "fallback_used": false,
  "failures_count": 0,
  "attempt_number": 1,
  "max_tokens": 256,
  "timeout_ms": 6000,
  "provider": "openai",
  "model": "gpt-4o-mini",
  "duration_ms": 2548
}
```

**Failure Details** (when `failures_count > 0`):
```json
"failures": [{
  "provider": "local",
  "model": "deepseek-r1:1.5b",
  "error_code": "CONNECTION_ERROR",
  "error_message": "fetch failed"
}]
```

## Configuration

### Environment Variables

```bash
# Lane-specific model overrides
TELEGPT_MODEL_CHEAP=local:deepseek-r1:1.5b
TELEGPT_MODEL_SMART=openai:gpt-4o-mini
TELEGPT_MODEL_CODING=openai:gpt-4o

# Provider configuration
OPENAI_API_KEY=sk-...
LOCAL_OPENAI_BASE_URL=http://127.0.0.1:11434/v1
LOCAL_OPENAI_MODEL=deepseek-r1:1.5b

# Agent mode
TELEGPT_AGENT_MODE=true
TELEGPT_KNOWLEDGE_PATH=./data/knowledge.json
TELEGA_MODE=creator
```

## Smoke Tests

### Test 1: Cheap Lane (Simple FAQ)
```bash
curl -sS -X POST http://localhost:8787/v1/ask \
  -H "content-type: application/json" \
  -d '{"message":"What are your hours?"}' | jq '.meta'
```

**Expected:**
```json
{
  "lane": "cheap",
  "intent": "inquiry",
  "max_tokens": 256,
  "timeout_ms": 6000,
  "fallback_used": false
}
```

### Test 2: Smart Lane (Complex Question)
```bash
curl -sS -X POST http://localhost:8787/v1/ask \
  -H "content-type: application/json" \
  -d '{"message":"Explain the difference between warranty and return policy"}' | jq '.meta'
```

**Expected:**
```json
{
  "lane": "smart",
  "intent": "warranty",
  "max_tokens": 768,
  "timeout_ms": 15000,
  "fallback_used": false
}
```

### Test 3: Coding Lane
```bash
curl -sS -X POST http://localhost:8787/v1/ask \
  -H "content-type: application/json" \
  -d '{"message":"Fix this TypeScript error: Property does not exist on type"}' | jq '.meta'
```

**Expected:**
```json
{
  "lane": "coding",
  "max_tokens": 1200,
  "timeout_ms": 25000,
  "fallback_used": false
}
```

### Test 4: Forced Fallback
Stop local provider (e.g., kill Ollama), then:

```bash
curl -sS -X POST http://localhost:8787/v1/ask \
  -H "content-type: application/json" \
  -d '{"message":"Hello"}' | jq '.meta'
```

**Expected:**
```json
{
  "provider": "local",
  "model": "local-demo",
  "fallback_used": true,
  "failures_count": 1,
  "attempt_number": 2
}
```

Check logs for failure details:
```bash
grep "fallback occurred" /tmp/p2-policy.log
```

## Implementation Details

### Lane Selection
`src/core/policyRouter.ts:pickLane(intent, message)`
- Priority: coding keywords > intent type > complexity indicators > message length
- Deterministic — same input = same lane

### Provider Chain Building
`src/core/policyRouter.ts:buildProviderChain(lane, env)`
- Respects env availability (skips if API key/base URL missing)
- Always includes `local-demo` as final fallback

### Fallback Execution
`src/core/llmFallback.ts:runWithFallback(chain, callProvider, request)`
- Iterates through chain on failure
- Classifies errors for observability
- Returns first successful response
- Logs all failures for debugging

## Future Enhancements

1. **Circuit Breaker** — Temporarily skip failing providers
2. **Policy Overrides** — Business-specific lane hints from Knowledge Pack
3. **Cost Tracking** — Per-lane budget limits
4. **Adaptive Routing** — Success rate → chain reordering
5. **Streaming Support** — Real-time token delivery

## References
- Intent Detection: `src/core/intent.ts`
- Agent Template: `src/core/agent.ts`
- Provider Strategy: `src/server/provider/strategy.ts`
- Traces API: `GET /v1/traces?limit=20`
