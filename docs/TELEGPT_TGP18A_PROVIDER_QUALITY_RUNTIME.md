# TeleGPT — TGP-18A Provider Quality Runtime — Verification

**Status:** LOCKED — `9a1f0c8`
**Parent:** TGP-17D (Provider Selection Orchestrator) — `0243a9d`
**Date:** 2026-07-19
**Scope:** Non-fatal observational quality runtime for all providers. Records quality
signals after every routing execution, aggregates into per-provider/taskType rolling
snapshots with confidence scoring, and exposes a diagnostics endpoint. Quality is
purely a side-channel — it never influences provider selection, health state, or
scoring decisions.

---

## 1. Objective

TGP-17A/B/C/D built the selection pipeline (Capabilities → Health → Scoring →
Selection). TGP-18A adds the **observational layer**: what actually happened
*after* a provider was selected and executed.

Quality Runtime answers:
- What is the per-provider, per-task success rate?
- How often do schema validations or tool calls fail?
- How often do retries or fallbacks occur?
- What is the aggregate weighted quality score with confidence?

**Critical design constraint:** Quality is read-only observational. It never feeds
back into scoring, health, or selection. This separation prevents feedback loops.

---

## 2. Architecture

```
Router executeWithOrchestrator()
        ↓
   Provider execution (success or failure)
        ↓
   evaluateProviderQuality(input)  ← non-fatal, wrapped in try/catch
        ↓
   Evaluator Chain:
     ├── executionOutcomeEvaluator   → execution_success / execution_failure / retry_required / fallback_required
     ├── structuredOutputEvaluator   → schema_valid / schema_invalid
     ├── toolCallValidityEvaluator   → tool_call_valid / tool_call_invalid
     └── taskCompletionEvaluator     → task_completed / task_incomplete / task_failed
        ↓
   recordQualitySignals(signals)
        ↓
   RollingQualityBucket (FIFO eviction, 100 samples default)
        ↓
   buildQualitySnapshot() → ProviderQualitySnapshot
        ↓
   Evidence emission (provider.quality.signal_recorded)
```

---

## 3. Quality Signal Taxonomy (`src/core/provider-quality-runtime.ts`)

```typescript
type QualitySignalType =
  | "execution_success" | "execution_failure"
  | "retry_required"    | "fallback_required"
  | "schema_valid"      | "schema_invalid"
  | "tool_call_valid"   | "tool_call_invalid"
  | "task_completed"    | "task_incomplete" | "task_failed";
```

Each signal carries:
- `providerId`, `modelId?`, `taskType`, `requestId`
- `value` (0.0–1.0)
- `weight` (1.0 default)
- `timestamp`

---

## 4. Task Type Normalization

```typescript
type TaskType =
  | "chat" | "reasoning" | "code" | "vision"
  | "function_calling" | "structured_output" | "long_context" | "generic";
```

`normalizeTaskType(t)` maps freeform strings from router meta:
- `"chat"`, `"conversation"`, `""` → `chat`
- `"reasoning"`, `"deep_reasoning"` → `reasoning`
- `"code"`, `"coding"` → `code`
- `"vision"`, `"image"` → `vision`
- `"function"`, `"tool"` → `function_calling`
- `"json"`, `"schema"`, `"structured"` → `structured_output`
- `"long"`, `"context"` → `long_context`
- anything else → `generic`

---

## 5. Quality Dimensions & Weighted Scoring

| Dimension            | Weight | Source Signals                                    |
|----------------------|--------|---------------------------------------------------|
| `taskCompletion`     | 0.30   | `task_completed` vs `task_incomplete` + `task_failed` |
| `schemaCompliance`   | 0.20   | `schema_valid` vs `schema_invalid`                  |
| `toolCallValidity`   | 0.20   | `tool_call_valid` vs `tool_call_invalid`            |
| `retryEfficiency`    | 0.10   | `retry_required` count / execution signals         |
| `fallbackAvoidance`  | 0.10   | `fallback_required` count / execution signals      |
| `validatorScore`     | 0.10   | Always 1.0 (reserved for future validators)       |

```typescript
weightedScore = Σ(dimensionScore × weight) / Σ(weight)
confidence = min(totalSamples / 20, 1.0)
```

---

## 6. Rolling Aggregation

- **Bucket key:** `${providerId}:${taskType}:${modelId?}`
- **FIFO eviction:** Max 100 samples per bucket (configurable via `maxSamplesPerBucket`)
- **Dimension recalculation:** Full recalculation on every signal insert
- **Memory bounded:** Oldest signal evicted when bucket exceeds capacity

---

## 7. Router Integration (`src/core/router.ts`)

Quality evaluation is wired into `executeWithOrchestrator()`:

**On success:**
```typescript
await evaluateProviderQuality({
  providerId, modelId, taskType, requestId,
  executionOk: true,
  retryCount: 0,
  fallbackUsed: providerId !== selectedProviderId,
  taskCompleted: true,
  completionQuality: "full",
  latencyMs, timestamp,
});
```

**On failure (before fallback):**
```typescript
await evaluateProviderQuality({
  providerId, modelId, taskType, requestId,
  executionOk: false,
  failureType: e.failureType,
  retryCount: 0,
  fallbackUsed: providerId !== selectedProviderId,
  taskCompleted: false,
  completionQuality: "none",
  latencyMs, timestamp,
});
```

Both are wrapped in `try/catch` — quality evaluation **never** throws into the
response path.

---

## 8. Gateway Diagnostics (`src/gateway/index.ts`)

```
GET /internal/provider-quality?providerId=kimi_api&taskType=chat&modelId=kimi-k3
```

Returns a single `ProviderQualitySnapshot` when `providerId` + `taskType` are
provided, or `{ snapshots, config }` for the full registry dump.

Authenticated via `gatewayAuthMiddleware`. Read-only. No upstream calls.

---

## 9. Evidence Emission

Two evidence types:
- `provider.quality.signal_recorded` — emitted per signal batch (non-fatal)
- `provider.quality.evaluation_failed` — emitted when an evaluator throws (non-fatal)

Both go through `appendEvidenceRecord`. Evidence is fire-and-forget.

---

## 10. Security & Sanitization

- Quality snapshots contain no credentials, API keys, or raw error messages
- Diagnostics endpoint authenticated, read-only
- Quality evaluation is non-fatal — wrapped in try/catch at every call site
- No provider keys, cookies, or bridge endpoints exposed

---

## 11. Test Coverage (52 new tests)

### Unit Tests — `tests/unit/provider/providerQualityRuntime.test.ts` (32 tests)
- Signal type taxonomy completeness
- Bucket creation, add signal, FIFO eviction
- Dimension recalculation (task completion, schema, tool calls, retries, fallbacks)
- Weighted score computation
- Confidence calculation (0/20 → 0.0, 10/20 → 0.5, 20/20 → 1.0)
- Snapshot building
- Quality registry CRUD (record, get, list, reset)
- Task type normalization
- Evaluator chain (execution, structured output, tool calls, task completion)
- Sanitization

### Integration Tests — `tests/unit/router/qualitySideChannel.test.ts` (20 tests)
- normalizeTaskType for all 8 task types + edge cases
- evaluateProviderQuality records signals to registry
- Retry/fallback signals emitted correctly
- Schema valid/invalid signals
- Tool call valid/invalid signals
- **Quality is observational — selection plan unchanged before/after negative signals**
- Registry accumulates across multiple evaluations
- Snapshots isolated by taskType

### Diagnostics Tests — `tests/unit/gateway/providerHealthDiagnostics.test.ts` (14 tests, 3 new)
- GET /internal/provider-quality returns 200 with all snapshots
- GET /internal/provider-quality returns single snapshot by provider+taskType
- Quality diagnostics response is sanitized

**Full suite: 330/330 pass (18 new + 312 regression)**

---

## 12. Lock Statement

TGP-18A is complete and verified:

- ✅ Quality signal taxonomy: 11 signal types across 4 evaluators
- ✅ Rolling bounded aggregation (100 samples, FIFO eviction)
- ✅ 6 quality dimensions with weighted scoring
- ✅ Confidence = min(samples/20, 1.0)
- ✅ Router integration: non-fatal evaluation in executeWithOrchestrator
- ✅ Gateway diagnostics: GET /internal/provider-quality
- ✅ Quality is purely observational — does NOT affect selection/scoring/health
- ✅ Evidence emission for signal recording and evaluation failures
- ✅ 330/330 tests pass (18 new + 312 regression)

**Adaptive Provider Runtime v1.4 — LOCKED** (TGP-17A–17D locked + 18A `9a1f0c8`).

---

## 13. Explicitly Deferred (Out of Scope)

- Quality feedback into scoring (TGP-18A is observational only)
- Token-budget optimization
- Live price / cost calculation
- Parallel provider racing / speculative execution
- Database persistence of quality history
- Model-specific quality profiles (current: taskType only)
- Budget & Cost Runtime (TGP-18B)
- Racing Runtime (TGP-18C)
