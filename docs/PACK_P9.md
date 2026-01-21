# Pack P9 — Task list filters + polling hints

## Goal
Make build task listing usable for live UI without adding complexity:
- filter by status/visibility
- provide polling hints
- keep stale computed at read-time

## Endpoint
GET `/v1/build/tasks`

### Query (optional)
- `limit` (1..100, default 20)
- `status` = queued|running|done|partial|blocked
- `visibility` = public|creator|core

### Response
```json
{
  "server_time_ms": 0,
  "poll_after_ms": 1500,
  "items": []
}
```

## Polling hints
- If there is at least one running task: `poll_after_ms = 1500`
- Otherwise: `poll_after_ms = 5000`

## Notes
- No DB mutations.
- Stale is computed at read-time (see Pack P8).
