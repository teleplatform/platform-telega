# Pack P10 — Task summary (counts + polling hints)

## Goal
Provide a lightweight summary endpoint for UI dashboards:
- counts by status
- stale running count
- polling hints without extra list queries

## Endpoint
GET `/v1/build/tasks/summary`

### Query (optional)
- `visibility` = public|creator|core

### Response
```json
{
  "server_time_ms": 0,
  "poll_after_ms": 1500,
  "stale_running": 0,
  "counts": {
    "queued": 0,
    "running": 0,
    "done": 0,
    "partial": 0,
    "blocked": 0
  }
}
```

## Polling rules
- if `running > 0` and `stale_running === 0` → `poll_after_ms = 1200`
- if `running > 0` and `stale_running > 0` → `poll_after_ms = 800`
- if `running === 0` and `queued > 0` → `poll_after_ms = 2500`
- otherwise → `poll_after_ms = 6000`
