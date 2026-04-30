# CHANGELOG — Session Canon Pack (Tele•GPT / Sigma Forge)
Дата: 2026-01-27  
Статус: CANONICAL (Session Wrap)  
Owner: Никита  
Scope: Tele•GPT Core Runtime → Tasks → Agents → G2F → KB/Intent → Skills → MediaFactory → LRL

---

## Итог сессии
Эта сессия превратила Tele•GPT из “API-сервера” в платформу: локальный провайдер с доказуемыми traces, самовосстанавливающаяся система задач, агентные модули с полной наблюдаемостью, generate-to-forge полный цикл, KB-2 + INTENT-2 (CAS/etag, DB-first overrides), SkillPacks (react lint brain), MediaFactory конвейер, и LRL слой лояльности.

---

## Pack B — Local Provider (OpenAI-compatible) + Proof
- Поднят local OpenAI-compatible endpoint (base url)
- /v1/ask пишет provider=local в traces (proof)
- /v1/models отражает реальные модели локального endpoint
- Usage tokens_in/out записывается в traces (если доступно)

---

## Pack C — Task System Self-Heal
- Heartbeat поддерживает running в живом состоянии
- Stale sweep блокирует задачи при потере heartbeat (STALE_HEARTBEAT)
- Status hardening: done/partial/blocked терминальные; конфликт → 409
- Smoke-скрипт: health + traces + sweep + 409 proof

---

## Pack D — Agent Modules + Full Observability
- Шаблон поведения агента (Sales/Support)
- Knowledge Pack v1 + loader
- Intent Routing v1 + Policy Router v1
- Agent Answer v1 с observability полями
- /v1/ask mode=agent возвращает intent/lane/fallback_used/failures_count/timeouts/max_tokens
- Traces расширены (lane/intent/fallback/limits/источники)
- Smoke: agent observability

---

## Pack E — Generate-to-Forge (G2F) Full Cycle
- Actionability gate v1 → создание BuildTask только при actionable
- Полный цикл: queued → running(heartbeat) → done(artifacts)
- Task artifacts: storage + endpoint
- Forge worker v1 для генерации artifacts и завершения задач
- Traces: generated_task_id + actionability_score + gate_reason + artifacts_count
- Smoke: G2F

---

## Pack F — KB-2 + INTENT-2
- KB-2 storage: payload_json + version + etag + CAS update (409 conflict)
- Endpoints: /v1/kb/:key (GET/PUT CAS)
- DB-first overrides: если есть в DB → source=db, иначе fallback file
- INTENT-2 hybrid: keyword-first; при confidence < threshold → LLM classify (json contract)
- /v1/ask + traces: knowledge_etag, intent_confidence + источники
- Smoke: kb2 + intent2

---

## Pack G — Skill Packs: react-best-practices “lint мозга”
- SkillPack структура и contract стадий: AutoReview → FixPlan → Patch
- Patch maker-only; Public → maker_required
- Endpoint: /v1/skills/react-best-practices/run
- Traces proof: skill_id, skill_stage, issues_count, patch_bytes, maker_mode
- Smoke: react skill

---

## Pack H — MediaFactory v1 (Image→Video→Audio→Mux→Export)
- SkillPack mediafactory + runner + validators
- Public: только Image (cover.jpg + pack.json)
- Maker: ffmpeg/ffprobe pipeline + валидаторы (mp4 exists, duration ok, 9:16, audio if required)
- Artifacts: artifacts/<run_id>/mediafactory/ + запись в task_artifacts
- Traces proof: validator flags + duration_sec
- Smoke: mediafactory

---

## Pack I — LRL (Loyalty & Retention Layer) v1
- Wallet: Teleton + BonusPoints
- Ledger (append-only) + idempotency по event_id
- LRL events/rules + runner
- Review Gate: 1–3 private, 4–5 public
- Action Maps inline (v1)
- Endpoints: events enqueue + run-once + wallet read
- Traces proof: awards, fraud flags, action_map_id
- Smoke: lrl

---

## Важные замечания безопасности
- В .env.main замечены “живые” ключи. Требуется ротация/отзыв и замена на безопасные placeholders в репозитории.

---

## Следующий этап (после упаковки)
- Pack J завершает фиксацию канона: PACK_INDEX, CANON_TODAY, тег релиза.
