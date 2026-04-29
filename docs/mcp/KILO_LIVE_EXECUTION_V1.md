# Kilo Live Execution v1

**Version:** 1.0
**Date:** 2026-04-29
**Status:** Active - Read-Only

---

## Overview

This document defines the live execution contract for TeleGPT → MCP → Kilo Code operations.

**Principle:** Read-only by default. Write operations require explicit owner approval.

---

## Architecture

```
TeleGPT (Telegram)
    ↓ Owner Command
MCP Gateway (telegpt-mcp-gateway-v1)
    ↓ Tool Invocation
Kilo Code Engine
    ↓ Execution
Workspace / Evidence
    ↓
TeleGPT (Telegram Response)
```

---

## Allowed Tools (Read-Only)

| Tool | Description | Status |
|-----|-------------|--------|
| `telegpt_health` | Health check | ✅ |
| `telegpt_read_file` | Read file contents | ✅ |
| `telegpt_workspace_status` | Get workspace info | ✅ |
| `telegpt_patch_preview` | Preview code changes | ✅ |
| `telegpt_grep` | Search pattern | ✅ |
| `git_status` | Git status | ✅ |
| `git_log` | Git history | ✅ |
| `git_show` | Show commit | ✅ |

---

## Blocked Tools (Write Operations)

| Tool | Reason | Status |
|-----|--------|--------|
| `telegpt_execute` | Arbitrary execution | ❌ Blocked |
| `telegpt_patch_apply` | Apply patches | ❌ Admin only |
| `git_commit` | Commit changes | ❌ Blocked |
| `git_push` | Push to remote | ❌ Blocked |
| `npm_install` | Install packages | ❌ Blocked |
| `write_file` | Write file | ❌ Blocked |

---

## Commands

| Command | Access | Description |
|---------|--------|-------------|
| `/kilo_ping` | Owner | Test MCP connection |
| `/kilo_workspace` | Owner | Get workspace status |
| `/kilo_read <path>` | Owner | Read file |
| `/kilo_grep <pattern>` | Owner | Search code |
| `/kilo_status` | Owner | Show tool permissions |

---

## Evidence Events

| Event | Description |
|-------|-------------|
| `kilo_tool_started` | Tool invocation started |
| `kilo_tool_completed` | Tool completed successfully |
| `kilo_tool_failed` | Tool execution failed |
| `kilo_tool_rejected` | Tool blocked |

---

## Evidence Format

```json
{
  "execution_id": "kexec_..._...",
  "user_id": "123456",
  "account_label": "★",
  "tool": "telegpt_read_file",
  "args": { "path": "src/index.ts" },
  "status": "completed",
  "duration_ms": 150,
  "timestamp": 1234567890
}
```

**Log file:** `data/telegram/kilo-execution.jsonl`

---

## Rate Limits

| Operation | Limit |
|-----------|-------|
| Read operations | 30/min |
| Tool invocations | 60/min |

---

## Error Responses

| Error | RU | EN |
|-------|----|----|
| Not owner | "Только для владельца" | "Owner only" |
| Tool blocked | "Инструмент заблокирован" | "Tool blocked" |
| MCP unreachable | "Kilo недоступен" | "Kilo unreachable" |
| Read error | "Ошибка чтения" | "Read error" |

---

## v1.1 (Planned)

- Streaming responses
- File uploads via Kilo
- Patch apply with approval workflow
- Git commit with approval

---

## Contract History

- v1.0: Initial read-only execution (2026-04-29)