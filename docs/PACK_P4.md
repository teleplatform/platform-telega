# Pack P4 — Provider Strategy + Rich Trace Meta

## Goals
- Explicit provider/model strategy (no guessing)
- Rich trace metadata for analytics and cost modeling
- Backward-compatible AskResponse with optional meta

## Provider strategy
Provider choice is centralized in `src/server/provider/strategy.ts`:
- If OpenAI key exists:
  - Use requested model if provided
  - Else default to `openai:gpt-4o-mini`
- Without key: `local-demo`

## Trace metadata additions
Stored in SQLite:
- `duration_ms` (canonical)
- `latency_ms` (alias, kept for compatibility)
- `request_bytes`, `reply_bytes`
- `tokens_in`, `tokens_out`, `cost_usd` (nullable)

## API response (AskResponse)
AskResponse remains backward compatible:
```json
{
  "trace_id": "...",
  "reply": "...",
  "mode": "echo",
  "meta": { "provider": "local", "model": "local-demo", "duration_ms": 123 }
}
```

## Local run
- `npm run dev:p2`
