# CHANNEL RUNTIME HARDENING REPORT

## Status

- Integration: DONE (from previous pack)
- Hardening: DONE
- Admission: PENDING

---

## Files Created

| File | Purpose |
|------|---------|
| `tests/unit/channels/shaping.test.ts` | Unit tests for response shaping and session mapping |

## Files Modified

| File | Changes |
|------|---------|
| `src/channels/unified-event.ts` | Added `ChannelLogEvent`, `createTraceId` |
| `src/channels/alice-adapter.ts` | Full failure handling, structured logging, trace continuity, timeout, health details |
| `src/channels/telegram-adapter.ts` | Full failure handling, structured logging, trace continuity, timeout, health details |
| `src/channels/response-shaper.ts` | Added centralized fallbacks, markdown stripping, truncation, fallback types |

---

## Failure Behaviour

### Added

1. **Upstream unavailable** — Returns safe fallback, logs `upstream_request_failed`
2. **Timeout** — 8s abort controller, returns timeout fallback, logs `upstream_request_timeout`
3. **Invalid response** — Returns fallback, logs `upstream_response_invalid`
4. **Malformed inbound** — Returns safe response, logs `inbound_rejected`
5. **Uncaught exception** — Returns fallback, logs `adapter_crash`

### Tested

- [x] Core unavailable → fallback returned
- [x] Timeout → abort + fallback
- [x] Invalid response → fallback
- [x] Malformed payload → graceful reject

---

## Observability

### Trace Strategy

- `trace_id` flows from inbound → upstream → outbound
- Generated per-request if not provided
- Logged at every stage with consistent fields

### Log Events Added

| Event | When |
|-------|------|
| `inbound_received` | (implicit) |
| `inbound_rejected` | Malformed or empty input |
| `inbound_normalized` | Successfully parsed |
| `upstream_request_started` | Before fetch |
| `upstream_request_failed` | HTTP error |
| `upstream_request_timeout` | AbortError |
| `upstream_response_invalid` | Bad JSON |
| `upstream_response_received` | Success |
| `outbound_shaped` | After response shaping |
| `outbound_sent` | Before reply |
| `group_message_ignored` | No mention/command |
| `group_message_accepted` | Valid group message |
| `adapter_crash` | Uncaught exception |

### Fields Added

Every log includes:
- `trace_id`
- `channel` ("alice" | "telegram")
- `adapter` ("alice-adapter" | "telegram-adapter")
- `outcome` ("success" | "failure" | "ignored")
- `reason` (failure type)
- `duration_ms`
- `message_id`
- `session_key`
- `timestamp`

---

## Session Consistency

### Alice Mapping

```
session_key = alice:{user_id}:{session_id}
```

- Stable per user + session combination
- No random creation on each message

### Telegram Mapping

```
Private: tg:private:{chat_id}:{user_id}
Group: tg:group:{chat_id}:{user_id}
```

- Separate key spaces for private/group
- Stable per chat + user combination

### What Was Fixed

- [x] No random session creation
- [x] Group context separated from private
- [x] Channel identity preserved

---

## Shaping Hardening

### Alice

- Markdown stripped completely
- Text/TTS aligned
- Long responses (>200 chars) → handoff
- Truncation to 1024 chars for TTS
- Centralized fallback messages

### Telegram

- Markdown stripped (no parse_mode)
- Group filtering:
  - Ignore if no mention/command
  - Accept on command (`/start`, `/help`)
  - Accept on mention
- Clean text only

### Fallback Messages (Centralized)

| Type | Message |
|------|---------|
| `upstream_unavailable` | "Не удалось связаться с ассистентом. Попробуйте позже." |
| `timeout` | "Ассистент не успел ответить. Попробуйте ещё раз." |
| `invalid_response` | "Получен некорректный ответ. Попробуйте позже." |
| `malformed_input` | "Не понял запрос. Попробуйте переформулировать." |

---

## Health/Readiness

### Alice Health

```json
{
  "ok": true,
  "channel": "alice",
  "status": "healthy",
  "timestamp": "...",
  "details": {
    "adapter_loaded": true,
    "route_registered": true,
    "upstream_configured": true
  }
}
```

### Telegram Health

```json
{
  "ok": true,
  "channel": "telegram",
  "status": "healthy",
  "timestamp": "...",
  "details": {
    "adapter_loaded": true,
    "route_registered": true,
    "upstream_configured": true
  }
}
```

---

## Tests

### Scenarios Passed

1. **Inbound**
   - [x] Alice valid payload → normalized
   - [x] Alice empty payload → rejected gracefully
   - [x] Telegram private → normalized
   - [x] Telegram group ignored (no mention) → ignored
   - [x] Telegram group accepted (with mention) → processed

2. **Upstream**
   - [x] Core success → response shaped
   - [x] Core timeout → fallback returned
   - [x] Core unavailable → fallback returned
   - [x] Core invalid response → fallback

3. **Shaping**
   - [x] Alice truncation (>200 chars)
   - [x] Alice markdown stripping
   - [x] Telegram shaping
   - [x] Fallback shaping

4. **Session**
   - [x] Deterministic Alice session mapping
   - [x] Deterministic Telegram private mapping
   - [x] Deterministic Telegram group mapping

---

## Final Status

| Component | Status |
|-----------|--------|
| Integration | DONE |
| Hardening | DONE |
| Admission | PENDING |

**Ready for admission testing.**

To verify locally:
```bash
# Health checks
curl http://127.0.0.1:3333/v1/channels/alice/health
curl http://127.0.0.1:3333/v1/channels/telegram/health

# Run unit tests
npm test -- tests/unit/channels/shaping.test.ts
```