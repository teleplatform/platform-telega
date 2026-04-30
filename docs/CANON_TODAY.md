# CANON_TODAY — 2026-01-27
Статус: CANONICAL  
Owner: Никита  
Scope: Tele•GPT Core + Sigma Forge Integration Surface

---

## Что стало каноном сегодня
- Локальный провайдер (OpenAI-compatible) с доказуемыми traces
- Самовосстанавливающиеся задачи (heartbeat/sweep/409 terminal hardening)
- Агентный слой с полной наблюдаемостью (lane/intent/fallback/limits)
- G2F: actionability gate → BuildTask → artifacts → trace linkage
- KB-2: CAS/etag + DB-first overrides
- INTENT-2: hybrid (keyword-first → LLM json contract)
- SkillPack react-best-practices: AutoReview → FixPlan → Patch (maker-only)
- MediaFactory v1: ffmpeg pipeline + валидаторы + Public/Maker
- LRL v1: Wallet + ledger + rules/events + review gate + antifraud + action maps

---

## Proof checklist (должно быть зелёным)
- smoke_agent_observability.sh
- smoke_g2f_fullcycle.sh (или эквивалент)
- smoke_kb2_intent2.sh
- smoke_skill_react_best_practices.sh
- smoke_mediafactory_v1.sh
- smoke_lrl_v1.sh

---

## Релиз
Тег релиза: **CANON-2026-01-27**  
Changelog: docs/CHANGELOG_SESSION.md
