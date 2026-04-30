# STRUCTURE CLEANUP PHASE 4 PLAN — src Internal Reorg

**Artifact ID:** `telegpt_structure_cleanup_phase4`
**Status:** PLANNED (not yet executed)
**Date:** 2026-04-30
**Author:** Canon System

---

## 1. Current src/ Structure

50 top-level directories in `src/`. Many are orphaned, overlapping, or misgrouped.

---

## 2. Current Problems

### 2.1 Overlapping Telegram directories
- `src/telegram/` — 60+ files (bot, buttons, forge-ui, creator session, etc.)
- `src/surfaces/telegram/` — 5 files (Phase 2 moves: renderer, session-control, etc.)
- `src/channels/` — telegram-adapter, unified-event, response-shaper
- **Problem:** Three separate Telegram-related directories with unclear boundaries

### 2.2 Alice directories scattered at top level
- 9 separate `src/alice-*/` directories at top level
- They depend on each other (alice-incident → alice-ops, alice-http → alice-bridge, etc.)
- **Problem:** Should be grouped under `src/bridges/alice/`

### 2.3 Arisha directories scattered at top level
- 2 separate `src/arisha-*/` directories
- **Problem:** Should be grouped under `src/bridges/arisha/`

### 2.4 Voice directories scattered at top level
- 4 separate `src/voice-*/` directories
- **Problem:** Should be grouped under `src/engines/voice/` or `src/surfaces/voice/`

### 2.5 bridge/ vs bridges/ confusion
- `src/bridge/` exists (chunker, contracts, orchestrator) — this is the Creator Bridge
- No `src/bridges/` directory
- **Problem:** Naming inconsistency

### 2.6 core/ is overloaded
- `src/core/` has 40+ files/subdirs including router, intent, authz, cost, forge, knowledge, lrl, etc.
- **Problem:** Too many unrelated concepts in one directory

### 2.7 runtime/ is overloaded
- `src/runtime/` has agents, bootstrap, chat-surface, delivery, events, execution-runtime, features, forge-bridge, media, repos, services, transport, voice, watchdog
- **Problem:** Mix of concerns (transport, execution, features, voice)

### 2.8 provider/ vs providers/
- `src/provider/` has 1 file (provider-router.ts)
- `src/providers/` has all actual provider implementations
- **Problem:** Duplicate naming

### 2.9 Python files in src/
- `src/__init__.py`
- `src/main.py`
- **Problem:** Python mixed with TypeScript

---

## 3. Proposed Target Structure

```
src/
├── core/                          # Keep — but cleaned up
│   ├── router/                    # ✅ Already good
│   ├── longform/                  # → Move to engines/longform/ (LOW RISK)
│   ├── intent.ts                  # Keep
│   ├── authz/                     # Keep
│   ├── auth/                      # Keep
│   ├── policy/                    # Keep
│   ├── cost/                      # Keep
│   ├── limits/                    # Keep
│   ├── forge/                     # Keep
│   ├── knowledge/                 # Keep
│   ├── lrl/                       # Keep
│   ├── observability/             # Keep
│   ├── ops-intelligence/          # Keep
│   └── *.ts (router.ts, db.ts, etc.) # Keep
│
├── engines/                       # NEW — execution engines
│   ├── longform/                  # ← from core/longform/ (LOW RISK)
│   └── voice/                     # ← from voice-*/ dirs (MEDIUM RISK — defer)
│
├── surfaces/                      # Already started
│   ├── telegram/                  # ← Phase 2 moved files + consider merging with src/telegram/
│   ├── browser/                   # NEW — browser surface (future)
│   └── cli/                       # NEW — CLI surface (future)
│
├── bridges/                       # NEW — bridge implementations
│   ├── creator/                   # ← from src/bridge/ (MEDIUM RISK — defer)
│   ├── alice/                     # ← from alice-*/ dirs (MEDIUM RISK — defer)
│   └── arisha/                    # ← from arisha-*/ dirs (MEDIUM RISK — defer)
│
├── browser-agent/                 # ✅ Already good
├── providers/                     # ✅ Already good
├── provider/                      # → DELETE (merge provider-router.ts into providers/)
├── server/                        # ✅ Already good
├── channels/                      # ✅ Already good
├── types/                         # ✅ Already good
├── i18n/                          # ✅ Already good
├── security/                      # ✅ Already good
├── config/                        # ✅ Already good
├── skills/                        # ✅ Already good
│
├── telegram/                      # → MERGE into surfaces/telegram/ (MEDIUM RISK — defer)
├── runtime/                       # → RESTRUCTURE (HIGH RISK — defer to Phase 5)
├── forge-bridge/                  # → Move to bridges/creator/forge/ (MEDIUM RISK — defer)
├── web-bridge/                    # → Move to bridges/creator/web/ (MEDIUM RISK — defer)
├── voice-loop/                    # → Move to engines/voice/loop/ (MEDIUM RISK — defer)
├── voice-runtime/                 # → Move to engines/voice/runtime/ (MEDIUM RISK — defer)
├── voice-surface/                 # → Move to engines/voice/surface/ (MEDIUM RISK — defer)
├── voice-transport/               # → Move to engines/voice/transport/ (MEDIUM RISK — defer)
├── alice-bridge/                  # → Move to bridges/alice/bridge/ (MEDIUM RISK — defer)
├── alice-http/                    # → Move to bridges/alice/http/ (MEDIUM RISK — defer)
├── alice-incident/                # → Move to bridges/alice/incident/ (MEDIUM RISK — defer)
├── alice-ingress-hardening/       # → Move to bridges/alice/ingress-hardening/ (MEDIUM RISK — defer)
├── alice-launch/                  # → Move to bridges/alice/launch/ (MEDIUM RISK — defer)
├── alice-ops/                     # → Move to bridges/alice/ops/ (MEDIUM RISK — defer)
├── alice-protocol/                # → Move to bridges/alice/protocol/ (MEDIUM RISK — defer)
├── alice-publish/                 # → Move to bridges/alice/publish/ (MEDIUM RISK — defer)
├── alice-trust/                   # → Move to bridges/alice/trust/ (MEDIUM RISK — defer)
├── arisha-memory/                 # → Move to bridges/arisha/memory/ (MEDIUM RISK — defer)
├── arisha-ux/                     # → Move to bridges/arisha/ux/ (MEDIUM RISK — defer)
│
├── app/                           # Next.js app routes — keep as-is
├── apps/                          # Sub-apps — keep as-is
├── components/                    # React components — keep as-is
├── hooks/                         # React hooks — keep as-is
├── ui/                            # UI primitives — keep as-is
├── styles/                        # Styles — keep as-is
├── utils/                         # Utilities — keep as-is
├── lib/                           # Library code — keep as-is
├── intel/                         # Intelligence layer — keep as-is
├── multilingual/                  # Multilingual support — keep as-is
├── data/                          # Data layer — keep as-is
├── evidence/                      # Evidence layer — keep as-is
├── features/                      # Feature flags — keep as-is
├── llm/                           # LLM utilities — keep as-is
├── worker/                        # Worker processes — keep as-is
├── workers/                       # Worker processes — keep as-is
│
├── __init__.py                    # DELETE — Python in TS project
├── main.py                        # DELETE — Python in TS project
└── mcp-stdio.ts                   # KEEP — MCP stdio adapter
```

---

## 4. Migration Batches (sequential, with build checks between)

### Batch 4A: LOW RISK — core/longform → engines/longform

| From | To | Risk | Import Impact |
|------|----|------|--------------|
| `src/core/longform/` | `src/engines/longform/` | LOW | Check `grep -r "from.*longform" src/` |

**Pre-flight:** `grep -r "from.*core/longform\|from.*longform-engine" src/`
**Expected:** Only `src/core/router.ts` imports it (dynamic import).

### Batch 4B: LOW RISK — Remove Python files

| File | Action | Risk |
|------|--------|------|
| `src/__init__.py` | `git rm` | ZERO |
| `src/main.py` | `git rm` | ZERO |

### Batch 4C: LOW RISK — provider/ → merge into providers/

| From | To | Risk | Import Impact |
|------|----|------|--------------|
| `src/provider/provider-router.ts` | `src/providers/provider-router.ts` | LOW | Check `grep -r "from.*provider/" src/` |

### Batch 4D: MEDIUM RISK — alice-*/ → bridges/alice/

All 9 alice directories → `src/bridges/alice/` subdirectories.
**Import impact:** HIGH — many cross-references between alice-*/ dirs.
**Recommendation:** Defer to Phase 4.5 (separate PR).

### Batch 4E: MEDIUM RISK — arisha-*/ → bridges/arisha/

2 directories → `src/bridges/arisha/` subdirectories.
**Import impact:** LOW — minimal cross-references.
**Recommendation:** Can do with Batch 4D.

### Batch 4F: HIGH RISK — voice-*/ → engines/voice/

4 directories → `src/engines/voice/` subdirectories.
**Import impact:** MEDIUM — tests reference these paths.
**Recommendation:** Defer to Phase 4.6 (separate PR).

### Batch 4G: HIGH RISK — telegram/ → surfaces/telegram/

60+ files merge.
**Import impact:** VERY HIGH — many references across server/, telegram/, runtime/.
**Recommendation:** Defer to Phase 5 (major restructuring).

### Batch 4H: HIGH RISK — runtime/ restructure

14 subdirectories need careful analysis.
**Import impact:** VERY HIGH — core execution path.
**Recommendation:** Defer to Phase 5.

---

## 5. Recommended Phase 4 Scope (safe subset)

**DO NOW (Phase 4):**
- Batch 4A: `core/longform/` → `engines/longform/`
- Batch 4B: Delete Python files
- Batch 4C: `provider/` → `providers/`

**DEFER (Phase 4.5/4.6):**
- Batch 4D: alice-*/ → bridges/alice/
- Batch 4E: arisha-*/ → bridges/arisha/
- Batch 4F: voice-*/ → engines/voice/

**DEFER (Phase 5):**
- Batch 4G: telegram/ → surfaces/telegram/
- Batch 4H: runtime/ restructure
- bridge/ → bridges/creator/
- forge-bridge/ → bridges/creator/forge/

---

## 6. Import Pre-flight Commands

```bash
# Batch 4A
grep -r "from.*core/longform\|from.*longform-engine" src/ tests/

# Batch 4C
grep -r "from.*provider/provider-router\|from.*\.\./provider/" src/ tests/

# Batch 4D
grep -r "from.*alice" src/ tests/ | head -30

# Batch 4E
grep -r "from.*arisha" src/ tests/ | head -10

# Batch 4F
grep -r "from.*voice-" src/ tests/ | head -20
```

---

## 7. Risk Assessment

| Batch | Risk | Build Risk | Time |
|-------|------|-----------|------|
| 4A: longform | LOW | LOW | 10 min |
| 4B: Python cleanup | ZERO | ZERO | 2 min |
| 4C: provider merge | LOW | LOW | 10 min |
| 4D: alice reorg | MEDIUM | MEDIUM | 30 min |
| 4E: arisha reorg | LOW | LOW | 15 min |
| 4F: voice reorg | HIGH | MEDIUM | 45 min |
| 4G: telegram merge | HIGH | HIGH | 2 hours |
| 4H: runtime restructure | HIGH | HIGH | 3 hours |

---

## 8. Rollback Plan

```bash
# If any batch fails:
git reset --hard HEAD~1

# Or restore from backup branch:
git checkout backup/longform-browser-v1
```

---

## 9. Success Criteria for Phase 4 (safe subset)

- [ ] `src/engines/longform/` exists and works
- [ ] `src/core/longform/` removed
- [ ] Python files removed from `src/`
- [ ] `src/provider/` directory removed
- [ ] `npm run build` succeeds
- [ ] No broken imports in `src/`, `tests/`, `scripts/`

---

**LOCKED** — execute batches sequentially. Build after each batch.
