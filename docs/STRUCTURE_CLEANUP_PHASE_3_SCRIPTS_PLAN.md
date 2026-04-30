# STRUCTURE CLEANUP PHASE 3 PLAN — Scripts Grouping

**Artifact ID:** `telegpt_structure_cleanup_phase3`
**Status:** PLANNED (not yet executed)
**Date:** 2026-04-30
**Author:** Canon System

---

## 1. Current State

`scripts/` contains **107 files** in a single flat directory. No subdirectories except `scripts/dev/` (created in Phase 2).

---

## 2. Target Grouping

### scripts/smoke/ (44 files)
All smoke test scripts — automated regression and integration tests.

| File | Moved To |
|------|----------|
| `smoke-agent-mvp-v1.sh` | `scripts/smoke/smoke-agent-mvp-v1.sh` |
| `smoke-anti-downgrade-k2.17.sh` | `scripts/smoke/smoke-anti-downgrade-k2.17.sh` |
| `smoke-backpressure.sh` | `scripts/smoke/smoke-backpressure.sh` |
| `smoke-billing-dispute-export-k2.5.sh` | `scripts/smoke/smoke-billing-dispute-export-k2.5.sh` |
| `smoke-billing-dispute-sim-k2.4.sh` | `scripts/smoke/smoke-billing-dispute-sim-k2.4.sh` |
| `smoke-billing-disputes-k2.2.sh` | `scripts/smoke/smoke-billing-disputes-k2.2.sh` |
| `smoke-billing-k2.sh` | `scripts/smoke/smoke-billing-k2.sh` |
| `smoke-billing-receipt-k2.1.sh` | `scripts/smoke/smoke-billing-receipt-k2.1.sh` |
| `smoke-billing-status-k2.3.sh` | `scripts/smoke/smoke-billing-status-k2.3.sh` |
| `smoke-cost-accounting.sh` | `scripts/smoke/smoke-cost-accounting.sh` |
| `smoke-enterprise-controls.sh` | `scripts/smoke/smoke-enterprise-controls.sh` |
| `smoke-key-registry-k2.12.sh` | `scripts/smoke/smoke-key-registry-k2.12.sh` |
| `smoke-key-rotation-k2.13.sh` | `scripts/smoke/smoke-key-rotation-k2.13.sh` |
| `smoke-live-loop.sh` | `scripts/smoke/smoke-live-loop.sh` |
| `smoke-mission-control.sh` | `scripts/smoke/smoke-mission-control.sh` |
| `smoke-observability.sh` | `scripts/smoke/smoke-observability.sh` |
| `smoke-ops-intelligence.sh` | `scripts/smoke/smoke-ops-intelligence.sh` |
| `smoke-policy-pin-k2.18.sh` | `scripts/smoke/smoke-policy-pin-k2.18.sh` |
| `smoke-receipt-export-k2.6.sh` | `scripts/smoke/smoke-receipt-export-k2.6.sh` |
| `smoke-recovery-resume.sh` | `scripts/smoke/smoke-recovery-resume.sh` |
| `smoke-registry-pin-k2.14.sh` | `scripts/smoke/smoke-registry-pin-k2.14.sh` |
| `smoke-signature-bindings-k2.15.sh` | `scripts/smoke/smoke-signature-bindings-k2.15.sh` |
| `smoke-signature-bindings-k2.16.sh` | `scripts/smoke/smoke-signature-bindings-k2.16.sh` |
| `smoke-storage-retention.sh` | `scripts/smoke/smoke-storage-retention.sh` |
| `smoke-unified-bundle-k2.8.sh` | `scripts/smoke/smoke-unified-bundle-k2.8.sh` |
| `smoke-unified-bundle-signed-zip-k2.11.sh` | `scripts/smoke/smoke-unified-bundle-signed-zip-k2.11.sh` |
| `smoke-unified-bundle-zip-k2.9.sh` | `scripts/smoke/smoke-unified-bundle-zip-k2.9.sh` |
| `smoke-unified-manifest-k2.7.sh` | `scripts/smoke/smoke-unified-manifest-k2.7.sh` |
| `smoke-user-dashboard.sh` | `scripts/smoke/smoke-user-dashboard.sh` |
| `smoke-user-plan-k1.3.sh` | `scripts/smoke/smoke-user-plan-k1.3.sh` |
| `smoke-user-session-detail.sh` | `scripts/smoke/smoke-user-session-detail.sh` |
| `smoke-verify-signed-zip-with-registry-k2.12.sh` | `scripts/smoke/smoke-verify-signed-zip-with-registry-k2.12.sh` |
| `smoke-verify-zip-cli-k2.10.sh` | `scripts/smoke/smoke-verify-zip-cli-k2.10.sh` |
| `smoke_agent_observability.sh` | `scripts/smoke/smoke_agent_observability.sh` |
| `smoke_kb2_intent2.sh` | `scripts/smoke/smoke_kb2_intent2.sh` |
| `smoke_lrl_v1.sh` | `scripts/smoke/smoke_lrl_v1.sh` |
| `smoke_mediafactory_v1.sh` | `scripts/smoke/smoke_mediafactory_v1.sh` |
| `smoke_skill_react_best_practices.sh` | `scripts/smoke/smoke_skill_react_best_practices.sh` |
| `smoke_tasks_selfheal.sh` | `scripts/smoke/smoke_tasks_selfheal.sh` |
| `agent-smoke.ts` | `scripts/smoke/agent-smoke.ts` |
| `kb2-smoke.ts` | `scripts/smoke/kb2-smoke.ts` |
| `local-provider-smoke.ts` | `scripts/smoke/local-provider-smoke.ts` |
| `tasks-smoke.ts` | `scripts/smoke/tasks-smoke.ts` |
| `translate-smoke.sh` | `scripts/smoke/translate-smoke.sh` |

### scripts/creator/ (37 files)
All creator bridge tests — web sessions, CDP, session management.

| File | Moved To |
|------|----------|
| `creator-web-analyze.ts` | `scripts/creator/creator-web-analyze.ts` |
| `creator-web-audit-provider.ts` | `scripts/creator/creator-web-audit-provider.ts` |
| `creator-web-audit-tail.ts` | `scripts/creator/creator-web-audit-tail.ts` |
| `creator-web-cooldown-clear.ts` | `scripts/creator/creator-web-cooldown-clear.ts` |
| `creator-web-deep-probe.ts` | `scripts/creator/creator-web-deep-probe.ts` |
| `creator-web-deepseek-test.ts` | `scripts/creator/creator-web-deepseek-test.ts` |
| `creator-web-disable.ts` | `scripts/creator/creator-web-disable.ts` |
| `creator-web-enable.ts` | `scripts/creator/creator-web-enable.ts` |
| `creator-web-enter-test.ts` | `scripts/creator/creator-web-enter-test.ts` |
| `creator-web-exec-test.ts` | `scripts/creator/creator-web-exec-test.ts` |
| `creator-web-explain-smoke.ts` | `scripts/creator/creator-web-explain-smoke.ts` |
| `creator-web-fallback-smoke.ts` | `scripts/creator/creator-web-fallback-smoke.ts` |
| `creator-web-final-test.ts` | `scripts/creator/creator-web-final-test.ts` |
| `creator-web-full-test.ts` | `scripts/creator/creator-web-full-test.ts` |
| `creator-web-mission-control.ts` | `scripts/creator/creator-web-mission-control.ts` |
| `creator-web-msg-test.ts` | `scripts/creator/creator-web-msg-test.ts` |
| `creator-web-parse-test.ts` | `scripts/creator/creator-web-parse-test.ts` |
| `creator-web-persist-smoke.ts` | `scripts/creator/creator-web-persist-smoke.ts` |
| `creator-web-priority-smoke.ts` | `scripts/creator/creator-web-priority-smoke.ts` |
| `creator-web-probe.ts` | `scripts/creator/creator-web-probe.ts` |
| `creator-web-rehab-set.ts` | `scripts/creator/creator-web-rehab-set.ts` |
| `creator-web-rehab-smoke.ts` | `scripts/creator/creator-web-rehab-smoke.ts` |
| `creator-web-reset.ts` | `scripts/creator/creator-web-reset.ts` |
| `creator-web-response-test.ts` | `scripts/creator/creator-web-response-test.ts` |
| `creator-web-runtime-status.ts` | `scripts/creator/creator-web-runtime-status.ts` |
| `creator-web-selectors.ts` | `scripts/creator/creator-web-selectors.ts` |
| `creator-web-status.ts` | `scripts/creator/creator-web-status.ts` |
| `creator-web-test.ts` | `scripts/creator/creator-web-test.ts` |
| `creator-web-worked-test.ts` | `scripts/creator/creator-web-worked-test.ts` |
| `creator-session-attach.ts` | `scripts/creator/creator-session-attach.ts` |
| `creator-session-cdp.ts` | `scripts/creator/creator-session-cdp.ts` |
| `creator-session-live-validate.ts` | `scripts/creator/creator-session-live-validate.ts` |
| `creator-session-login.ts` | `scripts/creator/creator-session-login.ts` |
| `creator-cdp-attach-deepseek.ts` | `scripts/creator/creator-cdp-attach-deepseek.ts` |
| `creator-cdp-attach-openai.ts` | `scripts/creator/creator-cdp-attach-openai.ts` |
| `creator-cdp-attach-qwen.ts` | `scripts/creator/creator-cdp-attach-qwen.ts` |
| `test-creator-bridge.sh` | `scripts/creator/test-creator-bridge.sh` |

### scripts/verify/ (7 files)
Bundle verification scripts.

| File | Moved To |
|------|----------|
| `verify-unified-bundle-signed-zip-k2.11.ts` | `scripts/verify/verify-unified-bundle-signed-zip-k2.11.ts` |
| `verify-unified-bundle-signed-zip-k2.12.ts` | `scripts/verify/verify-unified-bundle-signed-zip-k2.12.ts` |
| `verify-unified-bundle-signed-zip-k2.15.ts` | `scripts/verify/verify-unified-bundle-signed-zip-k2.15.ts` |
| `verify-unified-bundle-signed-zip-k2.16.ts` | `scripts/verify/verify-unified-bundle-signed-zip-k2.16.ts` |
| `verify-unified-bundle-signed-zip-k2.17.ts` | `scripts/verify/verify-unified-bundle-signed-zip-k2.17.ts` |
| `verify-unified-bundle-zip-k2.10.ts` | `scripts/verify/verify-unified-bundle-zip-k2.10.ts` |
| `openai-extension-smoke.sh` | `scripts/verify/openai-extension-smoke.sh` |

### scripts/ops/ (14 files)
Operational and infrastructure scripts.

| File | Moved To |
|------|----------|
| `telecore-key-registry.k2.12.ts` | `scripts/ops/telecore-key-registry.k2.12.ts` |
| `telecore-key-registry.k2.12.json` | `scripts/ops/telecore-key-registry.k2.12.json` |
| `telecore-signature-policy.k2.17.json` | `scripts/ops/telecore-signature-policy.k2.17.json` |
| `telegpt-runnerd.ts` | `scripts/ops/telegpt-runnerd.ts` |
| `telegpt-watchdog-daemon.sh` | `scripts/ops/telegpt-watchdog-daemon.sh` |
| `telegpt-watchdog.sh` | `scripts/ops/telegpt-watchdog.sh` |
| `tele-gpt-web.ts` | `scripts/ops/tele-gpt-web.ts` |
| `start-tele-gpt.sh` | `scripts/ops/start-tele-gpt.sh` |
| `watchdog-check.sh` | `scripts/ops/watchdog-check.sh` |
| `install-watchdog.sh` | `scripts/ops/install-watchdog.sh` |
| `setup-launchagent.sh` | `scripts/ops/setup-launchagent.sh` |
| `backup_sqlite.sh` | `scripts/ops/backup_sqlite.sh` |
| `test-telegram-artifact-bridge.sh` | `scripts/ops/test-telegram-artifact-bridge.sh` |
| `test_intel_flow.ts` | `scripts/ops/test_intel_flow.ts` |

### scripts/dev/ (4 files — already partially created)
Development and test utilities.

| File | Moved To |
|------|----------|
| `test-openai.ts` | Already at `scripts/dev/test-openai.ts` (Phase 2) |
| `test-bot-launch.mjs` | Already at `scripts/dev/test-bot-launch.mjs` (Phase 2) |
| `test_intel_flow.ts` | `scripts/dev/test_intel_flow.ts` |
| `release.sh` | `scripts/dev/release.sh` |

---

## 3. Dependency Analysis

### package.json references
```bash
grep -r "scripts/" package.json
```
Expected: package.json `"scripts"` field references specific files. All references will need updating.

### Documentation references
```bash
grep -r "scripts/" docs/
```
Expected: Some docs may reference script paths. Update after moves.

---

## 4. Execution Order (when ready)

```bash
# 1. Create subdirectories
mkdir -p scripts/smoke scripts/creator scripts/verify scripts/ops

# 2. Move smoke tests
git mv scripts/smoke-*.sh scripts/smoke/
git mv scripts/smoke_*.sh scripts/smoke/
git mv scripts/agent-smoke.ts scripts/smoke/
git mv scripts/kb2-smoke.ts scripts/smoke/
git mv scripts/local-provider-smoke.ts scripts/smoke/
git mv scripts/tasks-smoke.ts scripts/smoke/
git mv scripts/translate-smoke.sh scripts/smoke/

# 3. Move creator tests
git mv scripts/creator-web-*.ts scripts/creator/
git mv scripts/creator-session-*.ts scripts/creator/
git mv scripts/creator-cdp-*.ts scripts/creator/
git mv scripts/test-creator-bridge.sh scripts/creator/

# 4. Move verify scripts
git mv scripts/verify-*.ts scripts/verify/
git mv scripts/openai-extension-smoke.sh scripts/verify/

# 5. Move ops scripts
git mv scripts/telecore-*.ts scripts/ops/
git mv scripts/telecore-*.json scripts/ops/
git mv scripts/telegpt-*.ts scripts/ops/
git mv scripts/telegpt-*.sh scripts/ops/
git mv scripts/start-tele-gpt.sh scripts/ops/
git mv scripts/watchdog-check.sh scripts/ops/
git mv scripts/install-watchdog.sh scripts/ops/
git mv scripts/setup-launchagent.sh scripts/ops/
git mv scripts/backup_sqlite.sh scripts/ops/
git mv scripts/test-telegram-artifact-bridge.sh scripts/ops/
git mv scripts/test_intel_flow.ts scripts/ops/

# 6. Move dev scripts
git mv scripts/release.sh scripts/dev/

# 7. Update package.json references
# (only after moves complete and grep confirms what needs updating)

# 8. Build and verify
npm run build

# 9. Commit
git add -A
git commit -m "chore(structure): group scripts into subdirectories phase 3"
```

---

## 5. Risk Assessment

| Category | Risk | Mitigation |
|----------|------|-----------|
| `.sh` scripts | ZERO — standalone | No dependencies |
| `.ts` scripts | LOW — may have imports | Grep for imports before moves |
| `.json` files | ZERO — static config | No dependencies |
| `package.json` refs | LOW — needs update | Identify and fix all refs |
| Docs references | LOW — just paths | Update after moves |

**Overall Phase 3 Risk: LOW**

---

## 6. Rollback Plan

```bash
# If build fails after moves:
git reset --hard HEAD~1

# Or restore from backup branch:
git checkout backup/longform-browser-v1
```

---

**LOCKED** — execute sequentially. Grep for imports before moves.
