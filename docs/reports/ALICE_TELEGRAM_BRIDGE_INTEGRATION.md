# Alice + Telegram Bridge Pack v1 — INTEGRATION REPORT

## STATUS: ✅ COMPLETE

## WHAT WAS ADDED

### Files Created

| File | Purpose |
|------|---------|
| `src/channels/unified-event.ts` | Unified inbound/outbound event contracts |
| `src/channels/alice-adapter.ts` | Alice webhook adapter (Yandex Dialogs) |
| `src/channels/telegram-adapter.ts` | Telegram webhook adapter |
| `src/channels/response-shaper.ts` | Channel-specific response shaping |
| `src/channels/index.ts` | Channel routes registration |

### Files Modified

| File | Change |
|------|--------|
| `src/server/index.ts` | Added channel routes registration |
| `tsconfig.server.json` | Added channels to compilation |

### Inbound Contract

**UnifiedInboundEvent** structure used by both Alice and Telegram:
```typescript
{
  channel: "alice" | "telegram";
  trace_id: string;
  channel_user_id: string;
  channel_session_id: string;
  message_id: string;
  text: string;
  locale?: string;
  raw_payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}
```

### Session Mapping

- **Alice**: `session_id = alice:{user_id}:{session_id}`
- **Telegram**: `session_id = tg:{chat_id}:{user_id}`

### Outbound Shaping

| Channel | Shaping Rules |
|---------|---------------|
| Alice | `speak_text` (TTS), max 1024 chars, truncate long responses, handoff to TGM |
| Telegram | Markdown support, inline keyboards, group filtering (mention/command) |

### Core / Adapter / Vault Boundary

```
┌─────────────────────────────────────────┐
│           Tele•GPT Core                 │
│  - Router / Policy / Memory / Explain   │
│  - Vault (secrets)                     │
│  - Sigma Forge                          │
└─────────────────────────────────────────┘
           ↑↓ call via /chat
┌────────────────────┐    ┌────────────────────┐
│  Alice Adapter    │    │ Telegram Adapter   │
│  (transport only)  │    │ (transport only)  │
└────────────────────┘    └────────────────────┘
```

- ✅ No business logic in adapters
- ✅ No secrets in adapters
- ✅ No separate memory in adapters
- ✅ All orchestration via Core /chat endpoint

## TESTED

- [x] Channel routes compile without errors
- [x] Unified event types defined
- [x] Alice adapter maps webhook → UnifiedInboundEvent
- [x] Telegram adapter maps update → UnifiedInboundEvent
- [x] Response shaper handles both channels
- [x] Long response truncation for Alice (>200 chars → handoff)
- [x] Group filtering for Telegram (no auto-response)

## MANUAL CONFIGURATION REQUIRED

### 1. Alice Webhook
Configure in Yandex Dialogs:
```
Endpoint URL: https://your-host.com/v1/channels/alice/webhook
Auth token: set ALICE_AUTH_TOKEN env
```

### 2. Telegram Webhook
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-host.com/v1/channels/telegram/webhook"
```

### 3. Environment Variables
Add to `.env`:
```bash
TELEGPT_API_URL=http://127.0.0.1:3333
ALICE_AUTH_TOKEN=your_yandex_token
```

## SMOKE TESTS

```bash
# Health checks
curl http://127.0.0.1:3333/v1/channels/alice/health
curl http://127.0.0.1:3333/v1/channels/telegram/health

# Alice webhook test
curl -X POST http://127.0.0.1:3333/v1/channels/alice/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "meta": {
      "client_id": "test",
      "message_id": "123",
      "session_id": "sess1",
      "user_id": "user1",
      "application": {"app_id": "app1"},
      "locale": "ru-RU"
    },
    "request": {
      "command": "привет",
      "original_utterance": "привет"
    }
  }'
```

## ARCHITECTURE CONFIRMATION

✅ Alice and Telegram are parallel channel adapters over unified Tele•GPT Core  
✅ No separate "brain" in adapters  
✅ No secret duplication  
✅ Unified inbound contract  
✅ Channel-specific outbound shaping  
✅ Core-first orchestration
