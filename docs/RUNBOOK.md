# RUNBOOK — Tele•GPT K Sprint
Дата: 2026-01-27  
Owner: Никита

---

## 1) Task stuck (heartbeat expired)
Symptoms:
- `/api/v1/ready` warns `tasks_stale`
- tasks show `running` with old heartbeat

Actions:
1. Run `POST /api/v1/tasks/sweep`
2. Inspect blocked_reason = STALE_HEARTBEAT
3. Restart worker if needed

---

## 2) LRL spike / fraud flags
Symptoms:
- `/api/v1/ready` warns `lrl_backlog`
- traces show `RATE_SPIKE` / `CAP_HIT`

Actions:
1. Pause event producers
2. Run `POST /api/v1/lrl/run-once` in batches
3. Verify wallet ledger idempotency

---

## 3) ffmpeg missing
Symptoms:
- MediaFactory returns `ffmpeg_missing`

Actions:
1. Install ffmpeg/ffprobe
2. Re-run `scripts/smoke_mediafactory_v1.sh`

---

## 4) Provider down
Symptoms:
- /v1/ask errors with provider fail

Actions:
1. Check provider health (local/openrouter/dashscope)
2. Verify env keys and base URLs
3. Retry with fallback if enabled

---

## 5) SQLite locked / slow
Symptoms:
- requests hang or fail

Actions:
1. Restart server
2. Check disk space
3. Run trace retention sweep

---

## Trace retention
- Use `POST /api/v1/traces/sweep` with `{ "maker_mode": true, "days": 30 }`
