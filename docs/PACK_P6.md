# Pack P6 — Task Log (BuildTask/BuildResult) + Endpoints

## Goals
- Store BuildTask and BuildResult JSON by task_id
- Provide a simple API for create/update/result/list/get
- Keep existing P2/P3/P4/P5 endpoints intact

## Storage (SQLite)
Table: `build_tasks`

Fields:
- `task_id` (PK)
- `status` (queued|running|done|partial|blocked)
- `visibility` (public|creator|core)
- `title`
- `created_at`, `updated_at`
- `task_json`, `result_json`
- `error_code`, `error_message`

## Endpoints
- POST `/v1/build/tasks`
  - Body: BuildTask JSON
  - If `meta.task_id` is "auto" or empty, server generates a task_id
  - Response: `{ task_id, status }`

- POST `/v1/build/tasks/:task_id/result`
  - Body: BuildResult JSON
  - Updates status to `done|partial|blocked`
  - Response: `{ task_id, status }`

- GET `/v1/build/tasks?limit=`
  - Returns list of tasks (summary fields only)

- GET `/v1/build/tasks/:task_id`
  - Returns full task details (task_json + result_json)

## Quick test
```bash
npm run dev:p2

curl -sS -X POST http://localhost:8787/v1/build/tasks \
  -H "content-type: application/json" \
  -d '{"type":"build_task","version":"1.0","meta":{"task_id":"auto","created_at":0,"priority":"normal","mode":"smart","persona":"builder","ecosystem":"telega","visibility":"creator"},"goal":{"title":"Test task"}}'

curl -sS http://localhost:8787/v1/build/tasks?limit=5
```
