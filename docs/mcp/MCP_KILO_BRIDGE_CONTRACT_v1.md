# MCP ↔ Kilo Code Bridge Contract v1

## Overview

This contract defines how TeleGPT controls Kilo Code through MCP server as a temporary Sigma Forge execution layer.

**Version:** 1.0
**Created:** 2026-04-29
**Status:** Draft

---

## Architecture

```
TeleGPT (Telegram Bot)
    ↓
MCP Gateway (telegpt-mcp-gateway-v1)
    ↓
Kilo Code Engine
    ↓
Project Workspace
    ↓
Evidence → Telegram
```

---

## MCP Server

**Default URL:** `http://127.0.0.1:3000`

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tools/list` | POST | List available tools |
| `/tools/execute` | POST | Execute a tool |
| `/health` | GET | Server health check |

---

## Required Tools

TeleGPT requires these tools from MCP:

| Tool | Description |
|------|-------------|
| `telegpt_execute` | Execute arbitrary command |
| `telegpt_health` | Health check |
| `telegpt_read_file` | Read file contents |
| `telegpt_workspace_status` | Get workspace status |
| `telegpt_patch_plan` | Plan code change |
| `telegpt_patch_preview` | Preview code change |
| `telegpt_apply_status` | Get apply status |

---

## Execution Flow

### 1. Health Check

```
/mcp_status → GET /health → MCP → telegram
```

### 2. Read-Only Query

```
/ask → Claude/MCP → Result → telegram
```

### 3. Code Analysis

```
/analyze <path> → telegpt_read_file → MCP → telegram
```

### 4. Patch Planning

```
/patch_plan <task> → telegpt_patch_plan → MCP → review
```

### 5. Patch Apply (Owner Only)

```
/patch_apply <plan_id> → telegpt_patch_apply → MCP → verification → telegram
```

---

## Safety Rules

### Default: Read-Only

- All tools default to read-only
- Write operations require explicit approval

### Prohibited Operations

- ❌ `git push` (unless explicitly approved)
- ❌ Secret/key exposure
- ❌ External network calls (except defined endpoints)
- ❌ SQL mutations without dry-run

### Required Evidence

- All tool calls logged to `data/telegram/mcp-audit.jsonl`
- Evidence format:
  ```json
  {
    "timestamp": 1234567890,
    "user_id": "123456",
    "account_label": "★",
    "tool": "telegpt_execute",
    "args": {},
    "result": {},
    "duration_ms": 150
  }
  ```

---

## Rate Limits

| Operation | Limit |
|-----------|-------|
| Health checks | 60/min |
| Read queries | 30/min |
| Patch plans | 10/min |
| Patch applies | 5/min |

---

## Owner Commands

| Command | Description |
|---------|-------------|
| `/mcp_status` | Check MCP server health |
| `/mcp_tools` | List available tools |
| `/mcp_test` | Test MCP connection |
| `/kilo_status` | Check Kilo Code status |
| `/kilo_tools` | List Kilo Code tools |

---

## Evidence Events

| Event | Description |
|-------|-------------|
| `mcp_health_check_started` | Health check initiated |
| `mcp_health_check_completed` | Health check completed |
| `mcp_tool_executed` | Tool execution started |
| `mcp_tool_completed` | Tool execution completed |
| `mcp_tool_failed` | Tool execution failed |
| `kilo_status_checked` | Kilo status checked |

---

## Error Handling

| Error | Response |
|-------|----------|
| MCP unreachable | "MCP сервер недоступен" |
| Tool not found | "Инструмент не найден" |
| Execution timeout | "Превышен таймаут" |
| Permission denied | "Доступ запрещён" |

---

## i18n

All messages available in RU/EN:

| RU | EN |
|----|----|
| MCP сервер недоступен | MCP server unreachable |
| Инструментов: {count} | Tools: {count} |
| Выполняю... | Executing... |
| Готово! | Done! |
| Ошибка: {error} | Error: {error} |

---

## Contract Evolution

- v1.0: Initial draft (2026-04-29)
- Future versions will include:
  - Streaming responses
  - File uploads
  - Git integration (with approval)