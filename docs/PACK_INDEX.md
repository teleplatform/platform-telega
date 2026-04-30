# PACK_INDEX — Tele•GPT Canon Packs
Статус: CANONICAL  
Owner: Никита  
Updated: 2026-01-27

---

## Packs

### Pack B — Local Provider (OpenAI-compatible) + Proof
Цель: “железный” локальный провайдер и доказуемость в traces.  
Ключевые proof: provider=local, /v1/models, usage tokens.

### Pack C — Task System Self-Heal
Цель: задачи “как у взрослых”: heartbeat, stale sweep, терминальные статусы, 409.  
Ключевые proof: STALE_HEARTBEAT, conflict=409, smoke suite.

### Pack D — Agent Modules + Full Observability
Цель: агентные модули + наблюдаемость (lane/intent/fallback/limits).  
Ключевые proof: intent/lane/fallback_used/failures/timeouts/max_tokens + traces.

### Pack E — Generate-to-Forge (G2F) Full Cycle
Цель: actionability gate → BuildTask → artifacts → trace linkage.  
Ключевые proof: generated_task_id, actionability_score, artifacts_count.

### Pack F — KB-2 + INTENT-2
Цель: knowledge overrides с CAS/etag + hybrid intent классификация.  
Ключевые proof: knowledge_etag, intent_confidence, source/version, 409 conflict.

### Pack G — Skill Packs: react-best-practices “lint мозга”
Цель: AutoReview → FixPlan → Patch (maker-only patch) + traces proof.  
Ключевые proof: skill_id/stage/issues_count/patch_bytes/maker_mode.

### Pack H — MediaFactory v1
Цель: Image→Video→Audio→Mux→Export + валидаторы + Public/Maker.  
Ключевые proof: validator flags, duration_sec, artifacts manifest.

### Pack I — LRL (Loyalty & Retention Layer) v1
Цель: Wallet + Rules + Events/Triggers + Review Gate + Anti-fraud + Action Maps.  
Ключевые proof: ledger idempotency, awards/caps, review gate routing, traces.

---

## Canon Release
Текущий каноничный релиз: **CANON-2026-01-27**
