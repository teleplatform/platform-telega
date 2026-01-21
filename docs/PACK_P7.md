# Pack P7 — Runner heartbeat + running status

## Endpoint
POST `/v1/build/tasks/:task_id/heartbeat`

Body (optional):
- `runner_id` (string)
- `progress` (number 0..100)
- `note` (string, short)

## Behavior
- Sets status to `running` unless task is already done/partial/blocked
- Updates `heartbeat_at` and `updated_at`
- Does not finalize tasks (finalization only via `/result`)

## Quick test
```bash
npm run dev:p2

TASK_ID=... # from /v1/build/tasks create

curl -sS -X POST "http://localhost:8787/v1/build/tasks/$TASK_ID/heartbeat" \
  -H "content-type: application/json" \
  -d '{"runner_id":"forge-local","progress":10,"note":"starting"}'

curl -sS "http://localhost:8787/v1/build/tasks/$TASK_ID"
```
