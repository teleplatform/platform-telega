# STRUCTURE CLEANUP PLAN v1

**Artifact ID:** `telegpt_structure_cleanup_v1`
**Status:** PLANNED (not yet executed)
**Date:** 2026-04-30
**Author:** Canon System

---

## 1. Current Problems

### 1.1 Root-level pollution
- 14+ orphaned `.ts`/`.js` files at root (chat-types.ts, provider-router.ts, etc.)
- 8+ orphaned `.md` files at root (ALICE_TELEGRAM_BRIDGE_INTEGRATION.md, etc.)
- Multiple `.log` files at root (bot.log, server.log, telegram-*.log)
- Multiple `.env*` files committed (dangerous)
- `grok_logs.csv`, `telegram-bot.lastreply`, `tsx` binary at root

### 1.2 No .gitignore hardening
- `.env*` files are tracked by git
- `.run/*.pid` files tracked
- `.qwen/`, `.kilo/` tracked
- Log files tracked
- `node_modules/` not properly ignored
- `dist/` not properly ignored
- `.DS_Store` tracked

### 1.3 Directory ambiguity
- `src/` has everything: core, surfaces, bridges, engines, tests
- `docs/` mixed with canon, packs, sql, contracts, audit
- `scripts/` has 100+ files without sub-grouping
- `telega-city/` is a separate project but lives in this repo
- `apps/` has both UI and API
- `tests/` has voice, alice, arisha, authz, channels mixed
- `data/` and `evidence/` at root — should be under storage
- `skills/` and `packs/` at root — should be organized

### 1.4 File count
- **100+ scripts** in `scripts/` (no grouping)
- **50+ docs** in `docs/` (no grouping beyond canon/)
- **70+ tests** in `tests/` (no grouping)
- **50+ log/runtime files** scattered everywhere
- **14 orphaned TS files** at root

---

## 2. Target Structure

```
tele-gpt/
├── .env                          # gitignore — never commit
├── .gitignore                    # hardened
├── package.json
├── tsconfig.json
├── tsconfig.server.json
├── docker-compose.yml
├── Dockerfile
├── README.md                     # main docs only
├── CHANGELOG.md
├── SECURITY.md
├── CONTRIBUTING.md
├── VERSIONING.md
│
├── src/                          # core runtime source
│   ├── core/                     # router, intent, policy, authz, limits
│   │   ├── router/               # intent-router, lanes, scoring
│   │   ├── longform/             # longform-engine
│   │   ├── telegram/             # send-document, send-message
│   │   └── *.ts                  # router.ts, intent.ts, authz, etc.
│   │
│   ├── surfaces/                 # surface adapters
│   │   ├── telegram/             # telegram adapter, menu, commands
│   │   ├── web/                  # web surface (future)
│   │   └── cli/                  # CLI surface (future)
│   │
│   ├── bridges/                  # bridge implementations
│   │   ├── creator/              # creator bridge, session, CDP
│   │   ├── browser-agent/        # browser agent bridge (moved from src/)
│   │   ├── alice/                # alice bridges
│   │   └── arisha/               # arisha bridges
│   │
│   ├── engines/                  # execution engines
│   │   ├── longform/             # (moved from core/)
│   │   ├── voice/                # voice engine
│   │   └── forge/                # forge engine
│   │
│   ├── providers/                # LLM providers
│   │   ├── openai/
│   │   ├── qwen/
│   │   ├── deepseek/
│   │   ├── local/
│   │   └── creator/
│   │
│   ├── server/                   # HTTP server, routes, middleware
│   │   └── routes/
│   │
│   ├── channels/                 # channel adapters (unified)
│   ├── types/                    # shared type definitions
│   ├── config/                   # configuration loading
│   ├── i18n/                     # internationalization
│   ├── security/                 # security, auth, guards
│   ├── observability/            # logging, tracing, telemetry
│   └── skills/                   # runtime skills
│
├── apps/                         # sub-applications
│   ├── api/                      # telegpt-api (moved from telegpt-api/)
│   ├── ui/                       # web UI
│   └── extension/                # Chrome extension (moved from telegpt-extension/)
│
├── telega-city/                  # Sigma Forge (separate project — keep isolated)
│   └── sigma-forge/
│
├── docs/                         # documentation
│   ├── canon/                    # canonical specs (LOCKED)
│   ├── packs/                    # pack documentation
│   ├── policy/                   # policy documents
│   ├── audit/                    # audit reports
│   ├── contracts/                # API contracts
│   ├── sql/                      # SQL migrations docs
│   ├── trace/                    # trace layer docs
│   ├── alice/                    # alice documentation
│   ├── arisha/                   # arisha documentation
│   ├── reports/                  # runtime reports (moved from root)
│   └── STRUCTURE_CLEANUP_PLAN_v1.md
│
├── scripts/                      # operational scripts
│   ├── smoke/                    # smoke tests (smoke-*.sh)
│   ├── creator-web/              # creator web tests (creator-web-*.ts)
│   ├── creator-session/          # creator session tests
│   ├── setup/                    # setup scripts
│   ├── dev/                      # dev utilities
│   └── ci/                       # CI-related scripts
│
├── tests/                        # test suites
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── migrations/                   # database migrations (moved from db/)
├── storage/                      # runtime storage (data, evidence, logs)
│   ├── longform/                 # generated longform files
│   └── cache/
│
├── config/                       # runtime configs (policy JSON, etc.)
├── knowledge/                    # knowledge packs (JSON)
├── packs/                        # skill packs
├── skills/                       # skill definitions
├── services/                     # external service code (Python, etc.)
├── examples/                     # example code
├── .github/                      # GitHub workflows
├── .kilo/                        # dev tool rules (gitignored)
├── .qwen/                        # dev tool settings (gitignored)
├── .qoder/                       # dev tool settings (gitignored)
├── .telegpt/                     # runtime state (gitignored)
├── .telegpt_ledger/              # runtime ledger (gitignored)
├── .run/                         # PID files (gitignored)
├── .logs/                        # local logs (gitignored)
├── .data/                        # local data (gitignored)
└── dist/                         # build output (gitignored)
```

---

## 3. Migration Phases

### Phase 0: PROTECT (current — DONE)
- [x] Full state checkpoint committed
- [x] Backup branch created: `backup/longform-browser-v1`
- [ ] Create `backup/structure-cleanup-start` before Phase 1

### Phase 1: .gitignore hardening (SAFE — no file moves)
**Risk:** ZERO (only .gitignore changes)

Files to add to `.gitignore`:
```
# Secrets — NEVER commit
.env
.env.*
!.env.example
.env.save

# PID and runtime state
.run/
*.pid
.last-incoming
.telegpt/
.telegpt_ledger/

# Dev tool configs
.qwen/
.kilo/
.qoder/

# Local logs
*.log
*.err.log
*.out.log
*.watchdog.log
*.watchdog.err.log
telegram-bot.lastreply
grok_logs.csv
delivery-evidence.log
daemon.log
bot.log
server.log

# Build output
dist/
node_modules/
tsconfig.tsbuildinfo
tsx

# OS files
.DS_Store
thumbs.db

# Local data directories
.data/
.logs/
data/
evidence/

# Misc root files
*.sqlite
*.sqlite-journal
```

### Phase 2: Orphaned root file relocation (LOW RISK)
**Risk:** LOW (ts files need import path updates)

Move to `src/server/routes/legacy/` or appropriate home:
- `chat-session-manager.ts` → `src/surfaces/telegram/session-manager.ts`
- `chat-types.ts` → DELETE (duplicate of `src/types/chat.ts`)
- `output-normalization.ts` → `src/server/middleware/output-normalization.ts`
- `provider-router.ts` → DELETE (duplicate of `src/core/router.ts`)
- `response-extractor.ts` → `src/server/middleware/response-extractor.ts`
- `session-control.ts` → `src/surfaces/telegram/session-control.ts`
- `session-reset.ts` → `src/surfaces/telegram/session-reset.ts`
- `telegram-renderer.ts` → `src/surfaces/telegram/renderer.ts`
- `test-openai.ts` → `scripts/dev/test-openai.ts`
- `test_bot_launch.mjs` → `scripts/dev/test-bot-launch.mjs`

Move to `docs/reports/`:
- `ALICE_TELEGRAM_BRIDGE_INTEGRATION.md`
- `CHANNEL_BRIDGE_ADMISSION_REPORT_v1.md`
- `CHANNEL_RUNTIME_HARDENING_REPORT.md`
- `PHASE_0_EXECUTION_SHEET.md`
- `R16_LIVE_OPERATIONS_ACTIVATION_PROMPT.md`
- `S3_BARRIER_FIX_BRIEF.md`
- `S3_EXECUTION_SHEET.md`

### Phase 3: Script grouping (LOW RISK)
**Risk:** LOW (only moves, no content changes)

Group `scripts/` by function:
- `scripts/smoke/` ← all `smoke-*.sh` files (60+)
- `scripts/creator-web/` ← all `creator-web-*.ts` files (30+)
- `scripts/creator-session/` ← all `creator-session-*.ts` files (6)
- `scripts/setup/` ← setup-launchagent.sh, install-watchdog.sh
- `scripts/dev/` ← test files, tele-gpt-web.ts

### Phase 4: Internal source reorganization (MEDIUM RISK)
**Risk:** MEDIUM (requires import path updates)

Only after Phase 1-3 complete and verified:
- `src/browser-agent/` stays as-is (correct location)
- `src/core/longform/` → `src/engines/longform/`
- `src/core/telegram/` → `src/surfaces/telegram/send-document.ts`
- `src/alice-*/` → `src/bridges/alice/` (multiple dirs)
- `src/arisha-*/` → `src/bridges/arisha/` (multiple dirs)

### Phase 5: Extension and app organization (LOW RISK)
**Risk:** LOW (only moves)

- `telegpt-extension/` → `apps/extension/`
- `telega-city/` → keep as-is (separate project)

### Phase 6: Cleanup (HIGHEST RISK — do last)
**Risk:** HIGH (deletion is irreversible)

**Candidates for deletion (after verification):**
- Duplicate files identified in Phase 2
- Empty directories
- Dead symlinks

**Candidates for archiving (move to `.archive/`):**
- Old log files (all `*.log`)
- Old state files
- Deprecated scripts

---

## 4. Files to KEEP at root

```
.env.example              # template for secrets
package.json              # project manifest
tsconfig.json             # TypeScript config
tsconfig.server.json      # Server TypeScript config
docker-compose.yml        # Docker composition
Dockerfile                # Container definition
README.md                 # Project documentation
CHANGELOG.md              # Version history
SECURITY.md               # Security policy
CONTRIBUTING.md           # Contribution guide
VERSIONING.md             # Version policy
.release-please-manifest.json # release tooling
release-please-config.json    # release tooling
.gitignore                # git ignore rules
.gitattributes            # git attributes
.editorconfig             # editor config
.dockerignore             # Docker ignore
.nvmrc                    # Node version
requirements.txt          # Python deps
commitlint.config.cjs     # commit linting
tailwind.config.ts        # Tailwind config
dev-up.sh                 # dev environment up
dev-down.sh               # dev environment down
```

---

## 5. STRICT RULES

### Rule 1: NO SECRETS IN GIT
- `.env`, `.env.dev`, `.env.main`, `.env.save` — NEVER commit
- Any file with API keys, tokens, passwords — `.gitignore` or delete
- Already-committed secrets require `git filter-branch` or BFG

### Rule 2: NO DESTRUCTIVE CLEANUP WITHOUT CHECKPOINT
- Every phase must have a `git commit` checkpoint
- Never run `git clean -fd` without backup
- Never mass-delete without verification

### Rule 3: IMPORT PATHS MUST BE UPDATED
- Any `.ts` file move requires updating all `import` references
- Use `grep -r "from '.*old-path'" src/` before each move
- Run `npm run build` after every batch of moves

### Rule 4: NO MOVING ACTIVE CODE DURING DEVELOPMENT
- Only restructure when no active feature development is in progress
- Coordinate with any active development branches

### Rule 5: CANON DOCS ARE IMMUTABLE
- `docs/canon/*.md` files marked LOCKED must not be renamed or moved
- They can be superseded but not deleted

---

## 6. .gitignore Hardening Recommendations

### Current `.gitignore` (inadequate):
```
node_modules/
dist/
*.log
```

### Recommended additions:
```gitignore
# Secrets — NEVER commit
.env
.env.*
!.env.example
.env.save

# PID and runtime state
.run/
*.pid
.last-incoming
.telegpt/
.telegpt_ledger/

# Dev tool configs
.qwen/
.kilo/
.qoder/

# Local logs
*.err.log
*.out.log
*.watchdog.log
*.watchdog.err.log
telegram-bot.lastreply
grok_logs.csv
delivery-evidence.log
daemon.log

# Build artifacts
tsconfig.tsbuildinfo
tsx

# OS files
.DS_Store
thumbs.db

# Local data
.data/
.logs/
data/
evidence/

# SQLite
*.sqlite
*.sqlite-journal
```

---

## 7. Rollback Plan

If any phase fails:

```bash
# Rollback to last checkpoint
git reset --hard HEAD

# Or rollback to backup branch
git checkout backup/structure-cleanup-start
git branch -D release/canon-jan18
git branch release/canon-jan18 backup/structure-cleanup-start
```

---

## 8. Success Criteria

Phase 1 (.gitignore):
- [ ] `git status` shows 0 secret files
- [ ] `git status` shows 0 log files
- [ ] `git status` shows 0 dev tool configs

Phase 2 (root files):
- [ ] 0 orphaned `.ts`/`.js` files at root
- [ ] 0 orphaned report `.md` files at root
- [ ] All imports still resolve

Phase 3 (scripts):
- [ ] `scripts/` has max 5 subdirectories
- [ ] Each subdirectory has clear purpose

Phase 4 (source):
- [ ] `npm run build` succeeds
- [ ] All imports resolve
- [ ] No circular dependencies

---

## 9. Estimated Timeline

| Phase | Risk | Time | Dependencies |
|-------|------|------|-------------|
| 0: Protect | None | 5 min | — |
| 1: .gitignore | Zero | 10 min | Phase 0 |
| 2: Root files | Low | 30 min | Phase 1 |
| 3: Scripts | Low | 20 min | Phase 1 |
| 4: Source reorg | Medium | 2 hours | Phase 2-3 |
| 5: Apps | Low | 15 min | Phase 4 |
| 6: Cleanup | High | 30 min | Phase 5 |

**Total estimated time: ~3.5 hours** (can be done incrementally)

---

**LOCKED** — this plan must be followed sequentially. No skipping phases.
