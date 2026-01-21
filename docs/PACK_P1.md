# Pack P1 — MVP User Flow (Health → Ask → Trace)

## Endpoints
- GET `/health` -> `{ ok: true }`
- POST `/v1/ask`
  Request:
  - `message` (string, required)
  - `user_id` (string, optional)
  Response:
  - `trace_id` (string)
  - `reply` (string)
  - `mode` = `echo` | `openai`

## Local run
- `PORT=8787 npm run dev:p1`

## Notes
- Works without any external keys (echo mode).
- Provider integration will be done in the next packs.
