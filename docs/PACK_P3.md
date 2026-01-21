# Pack P3 — API Contract + Unified Errors + Provider Meta

## Goals
- Unified error shape for all API failures
- Store trace meta: ok/latency/error_code/error_message
- Canonical trace endpoints, with aliases for backward compatibility

## Unified error format
All error responses follow:

```json
{
  "trace_id": "...",
  "error": { "code": "BAD_REQUEST|NOT_FOUND|UPSTREAM_ERROR|INTERNAL_ERROR", "message": "..." }
}
```

## Endpoints (canonical)
- POST `/v1/ask`
- GET `/v1/traces?user_id=&limit=`
- GET `/v1/traces/:trace_id`

## Aliases (compat)
- GET `/v1/history` -> `/v1/traces`
- GET `/v1/trace/:trace_id` -> `/v1/traces/:trace_id`

## Storage (SQLite)
Table: `ask_traces`

P3 adds soft-migration columns:
- `ok` (1/0, default 1)
- `latency_ms` (nullable)
- `error_code` (nullable)
- `error_message` (nullable)

## Local run
- `npm run dev:p2`

## Quick test (local)
```bash
npm run dev:p2
curl -sS http://localhost:8787/health
curl -sS -X POST http://localhost:8787/v1/ask -H "content-type: application/json" -d '{"message":"hello","user_id":"nikita"}'
curl -sS http://localhost:8787/v1/traces
curl -sS http://localhost:8787/v1/history
```
