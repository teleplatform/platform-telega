# Kilo Controlled Write v1

**Version:** 1.0
**Date:** 2026-04-29
**Status:** Active - Controlled Write

---

## Overview

This document defines controlled write operations via Kilo Code bridge.

**Principles:**
- Apply requires explicit approval
- Through Kilo, not locally
- Verification after apply

---

## Pipeline

```
1. User request ( TeleGPT )
   ↓
2. Strategy ( via MCP / Kilo read )
   ↓
3. Patch Plan ( telegpt_patch_plan )
   ↓
4. Preview ( /kilo_patch_preview )
   ↓
5. Approval ( Owner: ★ | ★★ only )
   ↓
6. Apply ( telegpt_patch_apply via MCP )
   ↓
7. Verify ( pnpm build + git diff )
   ↓
8. Evidence + Audit ( telegram )
```

---

## Access Levels

| Label | patch_plan | patch_apply | rollback |
|-------|-----------|-------------|----------|
| ★ | ✅ | ✅ | ✅ |
| ★★ | ✅ | ✅ | ✅ |
| ★★★ | ✅ | ❌ | ❌ |
| public | ❌ | ❌ | ❌ |

---

## Commands

| Command | Access | Description |
|---------|--------|-------------|
| `/kilo_patch_plan <task>` | Owner | Create patch plan |
| `/kilo_patch_preview <plan_id>` | Owner | Preview diff |
| `/kilo_patch_apply <plan_id>` | ★/★★ | Apply patch |
| `/kilo_patch_status` | Owner | List plans |
| `/kilo_patch_rollback <apply_id>` | ★/★★ | Rollback |

---

## Guardrails

### Blocked Paths

| Pattern | Reason |
|---------|--------|
| `.env` | Secrets |
| `secrets` | Secrets |
| `keys` | Credentials |
| `node_modules` | Dependencies |
| `.pem`, `.key` | Private keys |

### Limits

| Limit | Value |
|-------|-------|
| Max files per patch | 5 |
| Max diff size | 50KB |

---

## Verification

After apply, automatically:

1. **Build:** `pnpm build`
2. **Git status:** Check no unexpected changes

If verification fails:
- Status: FAILED
- Rollback available

---

## Evidence Events

| Event | Description |
|-------|-------------|
| `kilo_patch_plan_created` | Plan created |
| `kilo_patch_apply_started` | Apply initiated |
| `kilo_patch_apply_completed` | Apply successful |
| `kilo_patch_apply_failed` | Apply failed |
| `kilo_patch_rollback` | Rollback executed |

---

## Evidence Format

```json
{
  "execution_id": "kexec_...",
  "plan_id": "patch_...",
  "apply_id": "apply_...",
  "user_id": "123456",
  "account_label": "★",
  "status": "completed",
  "verify_result": {
    "build_ok": true,
    "git_diff_clean": true
  }
}
```

---

## Error Responses

| Error | RU | EN |
|-------|----|----|
| Not owner | "Только для владельца" | "Owner only" |
| Not authorized | "Только ★ и ★★ могут" | "Only ★ and ★★ can" |
| Patch not found | "Patch план не найден" | "Patch plan not found" |
| Already applied | "Patch уже применён" | "Patch already applied" |
| Verify failed | "Верификация не пройдена" | "Verification failed" |

---

## v1.1 (Planned)

- Multi-step rollback
- Partial apply (file by file)
- Patch history
- Full diff viewer

---

## Contract History

- v1.0: Initial controlled write (2026-04-29)