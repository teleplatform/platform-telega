# Pack P5 — Usage → Trace (tokens/cost)

## Goals
- Capture provider usage (tokens/cost) when available
- Persist usage into SQLite traces
- Keep cost optional (no server-side price tables)

## Flow
Provider → `ChatResponse.meta.usage` → `ask_traces` fields:
- `tokens_in`
- `tokens_out`
- `cost_usd` (nullable)

## Notes
- `cost_usd` is only set when the provider supplies it.
- If usage is missing, fields stay null.

## Local run
- `npm run dev:p2`
