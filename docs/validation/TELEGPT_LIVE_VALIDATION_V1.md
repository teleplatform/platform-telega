# TeleGPT Live Validation v1

**Date:** 2026-04-29
**Status:** IN_PROGRESS
**Branch:** release/canon-jan18

---

## Validation Checklist

### 1. Output Delivery Contract v1.1

| Test | Method | Expected | Actual | Status |
|------|--------|---------|---------|--------|--------|
| Long text > 3500 chars | Send via bot | Chunks or file fallback | | PENDING |
| Very long > 12000 chars | Send via bot | File sent (.txt) | | PENDING |
| No truncation | Check final output | Full text delivered | | PENDING |
| Chunk count logged | Check logs | delivery_chunked | | PENDING |

**Test Script:**
```bash
# Long response test
curl -X POST http://127.0.0.1:8787/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Write a 5000 word essay on the history of artificial intelligence",
    "model": "gpt-4o"
  }'
```

---

### 2. Creator Account Identity Labels

| User ID | Label | Name | Status |
|--------|-------|------|------|--------|
| 267246987 | ★ | Nikita (main) | PENDING |
| 1166943180 | ★★ | Nikita (secondary) | PENDING |
| 591948691 | ★★★ | Arisha | PENDING |

**Test Method:**
1. Send /start from each account
2. Check logs: `[creator-control] /start { ..., label, account, ... }`
3. Verify label appears in evidence

**Expected Logs:**
```
# User 267246987 (Nikita main)
[creator-control] /start { user_id: 267246987, role: owner, label: "★", account: "Nikita (main)" }

# User 1166943180 (Nikita secondary)
[creator-control] /start { user_id: 1166943180, role: owner, label: "★★", account: "Nikita (secondary)" }

# User 591948691 (Arisha)
[creator-control] /start { user_id: 591948691, role: partner, label: "★★★", account: "Arisha" }
```

---

### 3. GPT-like Action Buttons

Buttons tested in chat flow:

| Button | Callback | Expected Behavior | Status |
|--------|----------|-----------------|--------|
| 🔁 Repeat | `action_repeat` | Rerun last prompt | PENDING |
| ✏️ Clarify | `action_clarify` | Ask for simpler answer | PENDING |
| 📄 Send as file | `action_file` | Send .txt download | PENDING |
| 🔊 Read aloud | `action_read_aloud` | TTS on response | PENDING |
| 🖼 Generate image | `action_image` | Generate from text | PENDING |
| 🧠 Switch provider | `action_provider` | Show provider menu | PENDING |
| 📌 Save | `action_save` | Save to jsonl | PENDING |

**Test Flow:**
1. Send any message to bot
2. Verify action buttons appear under response
3. Click each button
4. Verify expected behavior

---

### 4. Voice Layer v1

| Test | Method | Expected | Status |
|------|--------|---------|--------|
| /voice_on | Command | Enable voice mode | PENDING |
| /voice_off | Command | Disable voice mode | PENDING |
| /voice_status | Command | Show settings | PENDING |
| Voice message | Send .ogg | Transcribe | PENDING |
| Action: Read aloud | Click button | TTS output | PENDING |

**Test Script:**
```
# Enable voice
/voice_on

# Send voice message in chat

# Check status
/voice_status

# Try read aloud
action_read_aloud
```

---

### 5. Image Generation Layer v1

| Test | Method | Expected | Status |
|------|--------|---------|--------|
| /image "sunset" | Command | Generate image | PENDING |
| /image "logo" | Command | Generate image | PENDING |
| action_image | Button | Use last response | PENDING |
| Rate limit | 30/day | Error after limit | PENDING |
| /images | Command | Show history | PENDING |

**Test Commands:**
```
/image a simple futuristic logo
/image sunset on the beach
/images
```

---

### 6. MCP Bridge

| Test | Command | Expected | Status |
|------|---------|---------|--------|
| /mcp_status | Owner | Server health | PENDING |
| /mcp_tools | Owner | Tool list | PENDING |
| /mcp_test | Owner | Health result | PENDING |

**Expected Output:**
```
✅ MCP сервер онлайн
Latency: Xms
Инструментов: N
```

---

### 7. Kilo Code Bridge

| Test | Command | Expected | Status |
|------|---------|---------|--------|
| /kilo_status | Owner | Config + gateway | PENDING |
| /kilo_tools | Owner | Tools count | PENDING |

---

### 8. Safety Checks

| Test | Method | Expected | Status |
|------|--------|---------|--------|
| patch_apply owner-only | User tries | "Owner only" | PENDING |
| /mcp_* owner-only | User tries | "Owner only" | PENDING |
| No truncation | Long output | Full delivered | PENDING |

---

## Manual Test Commands

### Quick Test Sequence

```bash
# Start as owner
/start

# Enable voice
/voice_on
/voice_status

# Generate image
/image a sunset

# Save response
# (click 📌 Save button)

# Check MCP
/mcp_status
/mcp_test

# Check Kilo
/kilo_status

# Try owner-only as public user (should fail)
/mcp_status
```

### Output Delivery Test

```bash
# Send long prompt
Write a detailed 3000-word article about the future of AI.
```

Expected: Response delivered via chunks or file, NOT truncated.

---

## Validation Results Summary

| Category | Passed | Failed | Pending |
|----------|--------|--------|--------|
| Output Delivery | 0 | 0 | N |
| Account Labels | 0 | 0 | N |
| Action Buttons | 0 | 0 | N |
| Voice Layer | 0 | 0 | N |
| Image Layer | 0 | 0 | N |
| MCP Bridge | 0 | 0 | N |
| Kilo Bridge | 0 | 0 | N |
| Safety | 0 | 0 | N |

**Total: N tests**
**Passed: 0**
**Failed: 0**
**Pending: N**

---

## Known Issues

| Issue | Severity | Status |
|-------|---------|--------|
| | | |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|----------|
| Owner | Nikita | 2026-04-29 | |
| Partner | Arisha | 2026-04-29 | |
| QA | | | |

---

## Appendix: Test Accounts

| Account | User ID | Role | Label |
|---------|--------|------|-------|
| Nikita (main) | 267246987 | owner | ★ |
| Nikita (secondary) | 1166943180 | owner | ★★ |
| Arisha | 591948691 | partner | ★★★ |
| Test user | - | public | (none) |