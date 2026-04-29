# Sigma Forge Temp Shell Validation v1

**Date:** 2026-04-29
**Status:** PENDING

---

## Test Checklist

### 1. Task Creation

| Test | Command | Expected | Status |
|------|---------|----------|--------|
| Create as ★ | `/forge_task fix bug` | Task created | PENDING |
| Create as ★★ | `/forge_task fix bug` | Task created | PENDING |
| Create as ★★★ | `/forge_task fix bug` | Task created | PENDING |
| Create as public | `/forge_task fix bug` | Rejected | PENDING |
| Empty task | `/forge_task` | Usage error | PENDING |

---

### 2. Execution

| Test | Command | Expected | Status |
|------|---------|----------|--------|
| Auto-apply ★ | Task → Apply | Verified | PENDING |
| Auto-apply ★★ | Task → Apply | Verified | PENDING |
| Auto-apply ★★★ | Task → Await approval | Awaiting approval | PENDING |

---

### 3. Manual Apply

| Test | Command | Expected | Status |
|------|---------|----------|--------|
| Apply as ★ | `/forge_apply <id>` | Verified | PENDING |
| Apply as ★★ | `/forge_apply <id>` | Verified | PENDING |
| Apply as ★★★ | `/forge_apply <id>` | Rejected | PENDING |
| Apply as public | `/forge_apply <id>` | Rejected | PENDING |

---

### 4. Status

| Test | Command | Expected | Status |
|------|---------|----------|--------|
| Status by ID | `/forge_status <id>` | Task details | PENDING |
| All tasks | `/forge_status` | Task list | PENDING |
| History | `/forge_history` | Recent list | PENDING |

---

### 5. Rollback

| Test | Command | Expected | Status |
|------|---------|----------|--------|
| Rollback as ★ | `/forge_rollback <id>` | Rolled back | PENDING |
| Rollback as ★★ | `/forge_rollback <id>` | Rolled back | PENDING |
| Rollback as ★★★ | `/forge_rollback <id>` | Rejected | PENDING |

---

### 6. Storage

| Test | Check | Expected | Status |
|------|-------|----------|--------|
| Tasks exist | data/forge/tasks.jsonl | Entries created | PENDING |
| Valid JSON | Check entry | Valid JSON | PENDING |
| Fields correct | Check fields | All fields | PENDING |

---

## Test Script

### Quick Test

```bash
# Create task (auto-apply as ★)
/forge_task add console.log to router

# Check status
/forge_status

# Apply (if awaiting)
/forge_apply <TASK_ID>

# Rollback if needed
/forge_rollback <TASK_ID>

# History
/forge_history
```

---

## Expected Results

### /forge_task
```
🔨 Создаю task...
✅ Task создан: forge_abc123
🔨 Применяю task...
✅ Task выполнен!
```

### /forge_status
```
🔨 Forge #abc123
Title: add console.log to router
Status: Проверен
Patch: patch_xyz
Apply: apply_789
Created: 2026-04-29...
```

---

## Validation Summary

| Category | Passed | Failed | Pending |
|----------|--------|--------|---------|
| Task Creation | 0 | 0 | 5 |
| Execution | 0 | 0 | 3 |
| Manual Apply | 0 | 0 | 4 |
| Status | 0 | 0 | 3 |
| Rollback | 0 | 0 | 3 |
| Storage | 0 | 0 | 3 |

**Total: 21 tests**
**Passed: 0**
**Failed: 0**
**Pending: 21**

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|----------|
| Owner (★) | Nikita | 2026-04-29 | |
| QA | | | |