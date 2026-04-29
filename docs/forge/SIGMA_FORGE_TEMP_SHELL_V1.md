# Sigma Forge Temporary Shell v1

**Version:** 1.0
**Date:** 2026-04-29
**Status:** Active

---

## Overview

This document defines the Sigma Forge temporary shell - an operator command layer on top of TeleGPT + MCP + Kilo for product building before the real UI exists.

---

## Architecture

```
Operator (Telegram)
    ↓ Command
Forge Shell
    ↓
Strategy Engine (Kilo Read)
    ↓
Patch Plan (Kilo Controlled Write)
    ↓
Owner Approval (★/★★)
    ↓
Apply (Kilo → Filesystem)
    ↓
Verify (Build + Git)
    ↓
Evidence + Report (Telegram)
```

---

## Commands

| Command | Access | Description |
|---------|--------|-------------|
| `/forge_task <task>` | ★/★★★ | Create + execute task |
| `/forge_status [id]` | ★/★★★ | Show task(s) status |
| `/forge_apply <id>` | ★ | Apply pending task |
| `/forge_rollback <id>` | ★ | Rollback task |
| `/forge_history` | ★/★★★ | List recent tasks |

---

## Access Levels

| Label | create | apply | rollback |
|-------|--------|-------|----------|
| ★ | ✅ | ✅ | ✅ |
| ★★ | ✅ | ✅ | ✅ |
| ★★★ | ✅ | ❌ | ❌ |
| public | ❌ | ❌ | ❌ |

---

## Task Model

```typescript
interface ForgeTask {
  forge_task_id: string;
  user_id: string;
  account_label: string;
  title: string;
  task: string;
  status: "planned" | "awaiting_approval" | "applying" | "verified" | "failed" | "rolled_back";
  patch_plan_id?: string;
  apply_id?: string;
  evidence_refs: string[];
  error?: string;
  created_at: number;
  updated_at: number;
}
```

---

## Flow

### Quick Execute (★/★★)

```
/forge_task add validation to form
→ Create task
→ Kilo read workspace
→ Patch plan
→ Auto-apply (if authorized)
→ Verify (build + git)
→ Report
```

### Manual Approval (★★★)

```
/forge_task fix router bug
→ Create task
→ Kilo read workspace
→ Patch plan created
→ /forge_apply <task_id> (★ only)
→ Verify
→ Report
```

---

## Storage

**Location:** `data/forge/tasks.jsonl`

Format (JSONL):
```json
{"forge_task_id":"forge_...","user_id":"...","account_label":"★",...}
```

---

## Evidence

| Event | Description |
|-------|----------|
| `forge_task_created` | Task created |
| `forge_task_executed` | Task executed |
| `forge_task_completed` | Task verified |
| `forge_task_failed` | Task failed |
| `forge_task_rolled_back` | Task rolled back |

All events logged to `data/telegram/kilo-execution.jsonl`

---

## i18n

| RU | EN |
|----|----|
| Создаю task... | Creating task... |
| Применяю task... | Applying task... |
| Task выполнен! | Task completed! |
| Task не найден | Task not found |
| Ожидает одобрения | Awaiting approval |

---

## v1.1 (Planned)

- Multi-file tasks
- Task dependencies
- Async execution
- Real-time progress

---

## Contract History

- v1.0: Initial (2026-04-29)