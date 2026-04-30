# tele-gpt

## Live Loop PASS Definition

🔒 **PASS если ВСЕ пункты ниже истинны:**

### A. Run
- POST /v1/agent/run возвращает: sid, links.stream, links.status, links.evidence_verify

### B. Stream
- GET /v1/agent/stream?sid=... SSE отдаёт: session.created … session.completed | session.failed
- id монотонен
- Каждое событие реально присутствует в trace.jsonl

### C. Status
- GET /v1/agent/status?sid=... возвращает: state, last_eid, bundle_ref (после completion)

### D. Evidence
- POST /v1/evidence/verify результат: PASS
- Повторный вызов verify → PASS
- bundle_hash стабилен

### E. Инвариант (самый важный)
- UI / Forge / CLI не показывают ничего, чего нет в trace

**Если любой пункт ломается → ❌ FAIL → фиксим и не идём дальше.**

---

## Текущий статус

✅ Tele•GPT v1: завершён
✅ Client Zero: реализован
🧪 Smoke test: `bash scripts/smoke-live-loop.sh`

**Следующий шаг:** PASS → Hardening A (AuthZ/Ownership)

---

HTTP service.

## Quick start

```bash
npm install
cp .env.example .env.dev
npm run dev
```

`npm run dev` читает `.env.dev`.

Minimum required env: `PORT` (или `TELEGPT_PORT`) + один провайдер: `OPENAI_API_KEY` либо `LOCAL_OPENAI_BASE_URL` (и `LOCAL_OPENAI_MODEL`).

API error contract: see `docs/ERRORS.md`.

Health check (если меняли `PORT` — подставьте свой):
```bash
curl http://localhost:8787/health
```

## Dev

All commands assume you are in the repo root:

```bash
cd ~/Projects/tele-gpt
bash dev-up.sh
```

Dev notes: see CONTRIBUTING.md
Deploy notes: see DEPLOYMENT.md
