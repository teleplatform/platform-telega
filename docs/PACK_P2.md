# Pack P2 — Storage + Core Entities (SQLite)

## Endpoints
- GET `/health` -> `{ ok: true }`
- POST `/v1/ask`
  Request:
  - `message` (string, required)
  - `user_id` (string, optional)
  - `model` (string, optional)
  Response:
  - `trace_id` (string)
  - `reply` (string)
  - `mode` = `echo` | `openai`

- GET `/v1/trace/:trace_id`
  - Returns stored record for a trace.

- GET `/v1/history?user_id=&limit=`
  - Returns recent stored traces (default limit 20, max 100).

## Storage
- Default: SQLite file in `.data/tele-gpt.sqlite`
- Configurable via:
  - `TELEGPT_DATA_DIR` (default `.data`)
  - `TELEGPT_STORAGE` is reserved for future backends (currently only `sqlite`)

## Local run
- `PORT=8787 npm run dev:p2`

## Notes
- If `OPENAI_API_KEY` is missing, server runs in `echo` mode (local provider).
- Provider integration uses `routeChat` and core providers.
