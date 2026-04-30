# STRUCTURE CLEANUP PHASE 2 PLAN — Root Orphaned Files

**Artifact ID:** `telegpt_structure_cleanup_phase2`
**Status:** PLANNED (not yet executed)
**Date:** 2026-04-30
**Author:** Canon System

---

## 1. Root File Inventory

All files at repo root that are not standard project files.

---

## 2. Relocation Map

### 2.1 Runtime Source Candidates (need import path updates)

| Current File | Proposed Destination | Reason | Risk | Imports Need Update |
|-------------|---------------------|--------|------|-------------------|
| `chat-session-manager.ts` | `src/surfaces/telegram/session-manager.ts` | Telegram session logic | LOW | YES — grep for imports |
| `session-control.ts` | `src/surfaces/telegram/session-control.ts` | Telegram session control | LOW | YES — grep for imports |
| `session-reset.ts` | `src/surfaces/telegram/session-reset.ts` | Telegram session reset | LOW | YES — grep for imports |
| `telegram-renderer.ts` | `src/surfaces/telegram/renderer.ts` | Telegram message rendering | LOW | YES — grep for imports |
| `output-normalization.ts` | `src/server/middleware/output-normalization.ts` | Response normalization middleware | LOW | YES — grep for imports |
| `response-extractor.ts` | `src/server/middleware/response-extractor.ts` | Response extraction logic | LOW | YES — grep for imports |
| `chat-types.ts` | **DELETE** (duplicate of `src/types/chat.ts`) | Duplicate type definitions | ZERO | N/A |
| `provider-router.ts` | **DELETE** (duplicate of `src/core/router.ts`) | Duplicate routing logic | ZERO | N/A |

### 2.2 Scripts/Dev Candidates (no import issues — standalone scripts)

| Current File | Proposed Destination | Reason | Risk | Imports Need Update |
|-------------|---------------------|--------|------|-------------------|
| `test-openai.ts` | `scripts/dev/test-openai.ts` | Dev test script | ZERO | NO |
| `test_bot_launch.mjs` | `scripts/dev/test-bot-launch.mjs` | Dev test script | ZERO | NO |

### 2.3 Docs/Report Candidates (no import issues — documentation)

| Current File | Proposed Destination | Reason | Risk | Imports Need Update |
|-------------|---------------------|--------|------|-------------------|
| `ALICE_TELEGRAM_BRIDGE_INTEGRATION.md` | `docs/reports/ALICE_TELEGRAM_BRIDGE_INTEGRATION.md` | Integration report | ZERO | NO |
| `CHANNEL_BRIDGE_ADMISSION_REPORT_v1.md` | `docs/reports/CHANNEL_BRIDGE_ADMISSION_REPORT_v1.md` | Admission report | ZERO | NO |
| `CHANNEL_RUNTIME_HARDENING_REPORT.md` | `docs/reports/CHANNEL_RUNTIME_HARDENING_REPORT.md` | Hardening report | ZERO | NO |
| `PHASE_0_EXECUTION_SHEET.md` | `docs/reports/PHASE_0_EXECUTION_SHEET.md` | Execution sheet | ZERO | NO |
| `R16_LIVE_OPERATIONS_ACTIVATION_PROMPT.md` | `docs/reports/R16_LIVE_OPERATIONS_ACTIVATION_PROMPT.md` | Activation prompt | ZERO | NO |
| `S3_BARRIER_FIX_BRIEF.md` | `docs/reports/S3_BARRIER_FIX_BRIEF.md` | Fix brief | ZERO | NO |
| `S3_EXECUTION_SHEET.md` | `docs/reports/S3_EXECUTION_SHEET.md` | Execution sheet | ZERO | NO |

### 2.4 Logs/Data Candidates (should be gitignored, not moved)

| Current File | Action | Reason |
|-------------|--------|--------|
| `grok_logs.csv` | Gitignore only (already done) | Log data — no need to preserve |
| `telegram-bot.lastreply` | Gitignore only (already done) | Runtime artifact — no need to preserve |
| `*.log` files (6+) | Gitignore only (already done) | Logs — no need to preserve |

### 2.5 Must-Stay Root Files (do NOT touch)

| File | Reason |
|------|--------|
| `.env.example` | Template for secrets — must stay visible |
| `package.json` | Project manifest |
| `tsconfig.json` | TypeScript config |
| `tsconfig.server.json` | Server TypeScript config |
| `docker-compose.yml` | Docker composition |
| `Dockerfile` | Container definition |
| `README.md` | Project documentation |
| `CHANGELOG.md` | Version history |
| `SECURITY.md` | Security policy |
| `CONTRIBUTING.md` | Contribution guide |
| `VERSIONING.md` | Version policy |
| `tailwind.config.ts` | Tailwind configuration |
| `dev-up.sh` | Dev environment script — root-level convenience |
| `dev-down.sh` | Dev environment script — root-level convenience |
| `.release-please-manifest.json` | Release tooling |
| `release-please-config.json` | Release tooling |
| `commitlint.config.cjs` | Commit linting |
| `.eslintrc.cjs` | ESLint configuration |

---

## 3. Import Dependency Analysis

Before moving any `.ts` file, run these checks:

```bash
# For each file to be moved:
grep -r "from.*chat-session-manager" src/
grep -r "from.*session-control" src/
grep -r "from.*session-reset" src/
grep -r "from.*telegram-renderer" src/
grep -r "from.*output-normalization" src/
grep -r "from.*response-extractor" src/
grep -r "from.*chat-types" src/
grep -r "from.*provider-router" src/
```

Expected result: **ZERO matches** (these are likely unused or only self-imported).
If matches found, update import paths before committing moves.

---

## 4. Execution Order (when ready)

### Step 1: Verify no external imports
```bash
grep -r "from.*chat-session-manager\|from.*session-control\|from.*session-reset\|from.*telegram-renderer\|from.*output-normalization\|from.*response-extractor\|from.*chat-types\|from.*provider-router" src/ tests/ scripts/
```

### Step 2: Create destination directories
```bash
mkdir -p src/surfaces/telegram
mkdir -p src/server/middleware
mkdir -p scripts/dev
mkdir -p docs/reports
```

### Step 3: Move source files (with git mv to preserve history)
```bash
git mv chat-session-manager.ts src/surfaces/telegram/session-manager.ts
git mv session-control.ts src/surfaces/telegram/session-control.ts
git mv session-reset.ts src/surfaces/telegram/session-reset.ts
git mv telegram-renderer.ts src/surfaces/telegram/renderer.ts
git mv output-normalization.ts src/server/middleware/output-normalization.ts
git mv response-extractor.ts src/server/middleware/response-extractor.ts
```

### Step 4: Delete duplicates
```bash
git rm chat-types.ts
git rm provider-router.ts
```

### Step 5: Move scripts
```bash
git mv test-openai.ts scripts/dev/test-openai.ts
git mv test_bot_launch.mjs scripts/dev/test-bot-launch.mjs
```

### Step 6: Move docs
```bash
git mv ALICE_TELEGRAM_BRIDGE_INTEGRATION.md docs/reports/
git mv CHANNEL_BRIDGE_ADMISSION_REPORT_v1.md docs/reports/
git mv CHANNEL_RUNTIME_HARDENING_REPORT.md docs/reports/
git mv PHASE_0_EXECUTION_SHEET.md docs/reports/
git mv R16_LIVE_OPERATIONS_ACTIVATION_PROMPT.md docs/reports/
git mv S3_BARRIER_FIX_BRIEF.md docs/reports/
git mv S3_EXECUTION_SHEET.md docs/reports/
```

### Step 7: Verify build
```bash
npm run build
```

### Step 8: Commit
```bash
git add -A
git commit -m "chore(structure): relocate root orphaned files to proper directories"
```

---

## 5. Rollback Plan

```bash
# If build fails after moves:
git reset --hard HEAD~1

# Or restore from backup branch:
git checkout backup/longform-browser-v1
```

---

## 6. Risk Assessment

| Move Type | Risk | Mitigation |
|-----------|------|-----------|
| `.ts` source files | LOW — need import check | Grep for imports first |
| `.mjs` scripts | ZERO — standalone | No dependencies |
| `.md` docs | ZERO — documentation | No dependencies |
| Delete duplicates | ZERO — verified duplicates | Confirm content match first |

**Overall Phase 2 Risk: LOW**

---

## 7. Success Criteria

- [ ] 0 orphaned `.ts`/`.js`/`.mjs` files at root
- [ ] 0 orphaned report `.md` files at root
- [ ] `npm run build` succeeds
- [ ] `git status --short` shows no unexpected changes
- [ ] No broken imports in `src/`, `tests/`, `scripts/`

---

**LOCKED** — this plan must be followed sequentially. Execute import checks BEFORE any moves.
