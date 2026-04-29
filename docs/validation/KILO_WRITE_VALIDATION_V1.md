# Kilo Write Validation v1

**Date:** 2026-04-29
**Status:** PENDING

---

## Test Checklist

### 1. Patch Plan Creation

| Test | Command | Expected | Status |
|------|---------|----------|--------|
| Create plan | `/kilo_patch_plan add logging` | Plan created | PENDING |
| Missing task | `/kilo_patch_plan` | Usage error | PENDING |
| Non-owner denied | From friend | "Owner only" | PENDING |

---

### 2. Patch Preview

| Test | Command | Expected | Status |
|------|---------|----------|--------|
| Preview plan | `/kilo_patch_preview <plan_id>` | Diff shown | PENDING |
| Invalid ID | `/kilo_patch_preview invalid` | Not found | PENDING |

---

### 3. Patch Apply

| Test | Command | Expected | Status |
|------|---------|----------|--------|
| Apply as ★ | Owner (★) | Applied + verified | PENDING |
| Apply as ★★ | Owner (★★) | Applied + verified | PENDING |
| Apply as ★★★ | Partner (★★★) | Rejected | PENDING |
| Apply as public | Public user | Rejected | PENDING |
| Invalid plan | `/kilo_patch_apply invalid` | Not found | PENDING |

---

### 4. Rollback

| Test | Command | Expected | Status |
|------|---------|----------|--------|
| Rollback as ★ | Owner (★) | Rolled back | PENDING |
| Rollback as ★★ | Owner (★★) | Rolled back | PENDING |
| Rollback as ★★★ | Partner (★★★) | Rejected | PENDING |
| Invalid apply | `/kilo_patch_rollback invalid` | Not found | PENDING |

---

### 5. Guardrails

| Test | Input | Expected | Status |
|------|-------|----------|--------|
| Blocked .env | Plan to .env | Rejected | PENDING |
| Blocked secrets | Plan to secrets/ | Rejected | PENDING |
| Max files (5) | 6 files | Rejected | PENDING |
| Max diff (50KB) | >50KB diff | Rejected | PENDING |

---

### 6. Verification

| Test | Check | Expected | Status |
|------|-------|----------|--------|
| Build OK | pnpm build | Success | PENDING |
| Build fail | Bad code | FAILED status | PENDING |
| Git clean | No extra changes | Clean | PENDING |
| Git dirty | Extra files | Dirty warning | PENDING |

---

## Test Script

### Quick Test Sequence

```bash
# Create patch plan
/kilo_patch_plan add console.log to router

# Preview
/kilo_patch_preview <PLAN_ID>

# Apply (as ★)
/kilo_patch_apply <PLAN_ID>

# Check status
/kilo_patch_status

# Rollback if needed
/kilo_patch_rollback <APPLY_ID>
```

### Guardrail Test

```bash
# Try to patch .env (should fail)
/kilo_patch_plan add API_KEY to .env
# Expected: Rejected - Blocked path

# Try as ★★★ (should fail)
/kilo_patch_apply <PLAN_ID>
# Expected: Rejected - Only ★ and ★★
```

---

## Expected Results

### /kilo_patch_plan
```
✅ Patch план создан: patch_abc123
```

### /kilo_patch_preview
```
📋 Patch #abc123
Task: add console.log to router
Files: src/router.ts
Status: pending

src/router.ts:
```diff
--- original
+++ modified
@@ ... @@
```
```

### /kilo_patch_apply
```
🔧 Применяю patch...
✅ Patch применён: apply_xyz789

✅ Apply #xyz789
Сборка: OK
Git: clean
```

### /kilo_patch_rollback
```
↩️ Откатываю...
✅ Откат выполнен
```

---

## Validation Summary

| Category | Passed | Failed | Pending |
|----------|--------|--------|---------|
| Patch Plan | 0 | 0 | 3 |
| Preview | 0 | 0 | 2 |
| Apply | 0 | 0 | 4 |
| Rollback | 0 | 0 | 4 |
| Guardrails | 0 | 0 | 4 |
| Verification | 0 | 0 | 4 |

**Total: 21 tests**
**Passed: 0**
**Failed: 0**
**Pending: 21**

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|----------|
| Owner (★) | Nikita | 2026-04-29 | |
| Partner (★★) | | | |
| QA | | | |