# Creator Bridge Canon v4.1

Status: **LOCKED**

## Core Formula

```
INPUT
→ Strategy
→ Guardrails
→ Execution
→ Evidence
→ Output
```

## Layers

| Layer | Version | Description |
|-------|---------|-------------|
| Transport | v1 | CDP browser execution, DOM polling extractor |
| Resilience | v2 | Fallback chains, cooldowns, typed errors, persistent evidence |
| Providers | v3 | 10 web providers via CDP |
| Intelligence | v4 | AI strategy planner, automatic mode selection |
| Guardrails | v4.1 | Schema validation, provider allowlist, max 5 steps |

## v1 Transport

- CDP browser execution via Playwright
- DOM polling: `page.evaluate()` + `waitForFunction()`
- **No Playwright locator for streamed output**
- Trivial prompt bypass for health checks
- Profile-based session isolation per provider

## v2 Resilience

- Fallback chains per provider
- Cooldown on typed errors:
  - RATE_LIMIT / OVERLOAD → 10 min
  - EMPTY_OUTPUT / TIMEOUT → 2 min
  - AUTH_REQUIRED → infinite (manual reset)
- Typed error classification:
  - EMPTY_OUTPUT
  - TIMEOUT
  - RATE_LIMIT
  - OVERLOAD
  - AUTH_REQUIRED
  - DOM_SELECTOR_MISS
  - EXTRACTION_FAILED
- Persistent evidence JSONL: `data/creator-bridge/evidence.jsonl`
- Persistent cooldowns: `data/creator-bridge/cooldowns.json`

## v3 Providers

```
chatgpt_web     → default, general, creative
qwen_web        → fast, reasoning, default
deepseek_web    → logic, code, analyze
grok_web        → fast, creative, x
kimi_web        → long-context, document
perplexity_web  → research, latest, source, news
claude_web     → writing, document, long reasoning
gemini_web     → vision, multimodal, google
poe_web        → model aggregator, compare
```

**Total: 9 web providers**

### Intent Routing

```typescript
if message includes "research/latest/news/source" → perplexity_web
if message includes "write/summarize/document" → claude_web
if message includes "image/vision/visual" → gemini_web
if message includes "compare/aggregate" → poe_web
if message includes "code/logic/analyze" → deepseek_web
default → qwen_web
```

## v4 Intelligence - Strategy Engine

```typescript
type ExecutionStrategy = {
  mode: "single" | "multi_agent" | "debate" | "research";
  providers: SessionProviderId[];
  steps: ExecutionStep[];
  expectedOutput: string;
  reasoning: string;
};
```

- Strategy built via qwen_web AI analysis
- Modes:
  - **single**: one provider
  - **research**: perplexity_web for info
  - **multi_agent**: multiple providers sequentially
  - **debate**: multi_provider with opposing views
- Router uses strategy for messages > 100 chars

## v4.1 Guardrails

- Schema validation:
  - mode must be valid
  - providers must be known
  - steps must be 1-5
- Provider allowlist: 9 known providers
- Max 5 strategy steps
- Auto-fallback to rule-based strategy if invalid
- Strategy evidence logged

## Operator Commands

```
/bridge_status              → Provider health
/bridge_evidence          → Recent executions
/bridge_failures         → Failed executions
/provider_health         → Duplicate of /bridge_status
/bridge_reset_provider   → Reset cooldown
/bridge_strategy        → Show strategy decision
/bridge_strategy_verbose → Show strategy + evidence
```

## Hard Rules

1. `*_web` providers must never fallback to API
2. CDP is the only execution path
3. Extract via `page.evaluate()` + polling, not locator
4. Strategy is suggested by AI but verified by system
5. Evidence is mandatory for serious execution

## Execution Order

```
1. Trivial prompt bypass → return directly
2. Explicit mode (multi/debate) → force mode
3. Strategy Engine (>100 chars) → AI decides
4. Provider Intelligence → fallback selection
5. executeWithFallback → execute with auto-retry
```

## Canon

```
AI decides.
System verifies.
Evidence records reality.
```

## Related Files

- `src/providers/creator/session/adapters.ts` - Web adapters
- `src/providers/creator/session/browser-runtime.ts` - CDP execution
- `src/providers/creator/provider-intelligence.ts` - Fallback logic
- `src/providers/creator/strategy-engine.ts` - Strategy planning
- `src/providers/creator/evidence-store.ts` - Evidence persistence
- `src/core/router.ts` - Execution routing

---

Status: **LOCKED** - Next: v5 Jobs Runtime