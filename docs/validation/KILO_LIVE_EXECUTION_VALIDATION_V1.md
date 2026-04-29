# Kilo Live Execution Validation v1

**Date:** 2026-04-29
**Status:** PENDING
**Branch:** release/canon-jan18

---

## Test Checklist

### 1. Connection Tests

| Test | Command | Expected | Status |
|------|---------|----------|--------|
| Ping | `/kilo_ping` | ✅ Pongs with latency | PENDING |
| Workspace | `/kilo_workspace` | ✅ Shows workspace status | PENDING |
| MCP test | `/mcp_test` | ✅ Health result | PENDING |

---

### 2. Read Operations

| Test | Command | Expected | Status |
|------|---------|----------|--------|
| Read file | `/kilo_read src/index.ts` | File contents | PENDING |
| Grep search | `/kilo_grep function` | Match results | PENDING |
| Grep path | `/kilo_grep function src/` | Filtered results | PENDING |
| Workspace status | `/kilo_workspace` | File count, git status | PENDING |

---

### 3. Safety Tests

| Test | Command | Expected | Status |
|------|---------|----------|--------|
| Non-owner denied | From public user | "Owner only" | PENDING |
| Blocked execute | Try telegpt_execute | Rejected | PENDING |
| Blocked write | Try write_file | Rejected | PENDING |
| Blocked git push | Try git_push | Rejected | PENDING |

---

### 4. Evidence Logging

| Test | Check | Expected | Status |
|------|-------|----------|--------|
| Execution log | data/telegram/kilo-execution.jsonl | Entries created | PENDING |
| Event format | Check log entry | Valid JSON | PENDING |
| User tracking | Check user_id | Tracked | PENDING |
| Label tracking | Check account_label | ★/★★/★★★ | PENDING |

---

## Test Script

### Quick Test Sequence

```bash
# Ping Kilo
/kilo_ping

# Get workspace status
/kilo_workspace

# Read a file
/kilo_read src/index.ts

# Search code
/kilo_grep function

# Check status
/kilo_status
```

### Safety Test

```bash
# As non-owner (should fail)
/kilo_ping
# Expected: "Owner only"
```

---

## Expected Results

### /kilo_ping
```
✅ Kilo пингуется!
Задержка: 150ms
```

### /kilo_read src/index.ts
```
[File contents]
```

### /kilo_grep function
```
🔍 Найдено: 25 совпадений
src/index.ts:10 function main() {
src/bot.ts:15 function handle() {
...
```

### /kilo_status
```
🧠 Kilo Live Status

MCP: ✅ Online

Разрешённые инструменты:
• telegpt_health
• telegpt_read_file
• telegpt_workspace_status
• telegpt_patch_preview
• telegpt_grep
...

Заблокированные инструменты:
• telegpt_execute
• telegpt_patch_apply
• git_commit
• git_push
• npm_install
...
```

---

## Validation Summary

| Category | Passed | Failed | Pending |
|----------|--------|--------|---------|
| Connection | 0 | 0 | 3 |
| Read Ops | 0 | 0 | 4 |
| Safety | 0 | 0 | 4 |
| Evidence | 0 | 0 | 4 |

**Total: 15 tests**
**Passed: 0**
**Failed: 0**
**Pending: 15**

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|----------|
| Owner | Nikita | 2026-04-29 | |
| QA | | | |