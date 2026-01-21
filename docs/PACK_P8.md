# Pack P8 — Stale detection for running build tasks

## Goal
Expose stale status for running tasks without mutating DB state.

## Config
- `TELEGPT_TASK_STALE_MS` (default: 90000)

## Behavior
- Only applies when `status === "running"`
- If `heartbeat_at` is null → `stale = true`
- Else `stale = (now - heartbeat_at) > TELEGPT_TASK_STALE_MS`

## Where it appears
- `GET /v1/build/tasks` items include:
  - `heartbeat_at`
  - `heartbeat_age_ms`
  - `stale`
- `GET /v1/build/tasks/:task_id` includes the same fields

## Quick test
```bash
npm run dev:p2

TASK_ID=... # from /v1/build/tasks create

curl -sS -X POST "http://localhost:8787/v1/build/tasks/$TASK_ID/heartbeat" \
  -H "content-type: application/json" \
  -d '{"runner_id":"forge-local","progress":10,"note":"starting"}'

curl -sS "http://localhost:8787/v1/build/tasks/$TASK_ID"
```
