# Creator Web Bridge v2

## Status

```
Creator Web Bridge v2 = COMPLETED ✅

Provider Transport Mapping:
- openai_web:   Extension Bridge (DOM injection)
- qwen_web:    CDP Bridge
- deepseek_web: CDP Bridge
```

## Architecture

### Transport Types

| Provider | Transport | Method |
|----------|-----------|--------|
| openai_web | Extension | window.postMessage → content-script → DOM |
| qwen_web | CDP | chromium.connectOverCDP → page actions |
| deepseek_web | CDP | chromium.connectOverCDP → page actions |

## Verified Results

```
🟢 PASS qwen_web: QWEN_OK (CDP)
🟢 PASS deepseek_web: DEEPSEEK_OK (CDP)
🟢 PASS openai_web: EXTENSION_OK (Extension Bridge)
```

## Overview

CDP Transport Layer provides a non-API browser-based transport for Creator-class web providers. Instead of using API keys, it reuses authenticated browser sessions via Chrome DevTools Protocol (CDP).

## Key Principles

### Security / Governance Rules

- **No credential capture** — passwords never stored
- **No password storage** — no credentials in `.env` or config
- **No automated login** — login happens manually outside TeleGPT
- **No anti-bot bypass** — no attempts to circumvent Cloudflare
- **Manual login only** — user logs in to browser manually
- **CDP attach only** — TeleGPT connects to already-authenticated session

## Architecture

### Transport Types

```typescript
export type ProviderTransport = "api" | "local" | "web_cdp";
```

### Session Health States

```typescript
export type SessionHealth =
  | "alive"           // Session active and authenticated
  | "login_required"  // User needs to login manually
  | "challenge_detected" // Cloudflare/challenge present
  | "browser_unreachable" // Cannot connect to CDP
  | "tab_missing";     // No matching tab found
```

## Directory Structure

```
src/providers/web/cdp/
├── cdp.types.ts      # Types and configs
├── cdp.browser.ts    # CDP connection management
├── cdp.session.ts    # Session state manager
├── cdp.health.ts     # Health monitoring
├── cdp.registry.ts   # Provider registry
├── cdp.bridge.ts     # Main bridge for execution
└── index.ts          # Exports
```

### Provider Descriptors

```
src/providers/openai_web/
src/providers/qwen_web/
src/providers/deepseek_web/
```

All use the same CDP runtime but have different adapter configs.

## Provider Configs

| Provider     | URL              | Transport |
|--------------|------------------|-----------|
| openai_web   | chatgpt.com      | web_cdp   |
| qwen_web     | qwen.ai          | web_cdp   |
| deepseek_web | chat.deepseek.com| web_cdp   |

## Usage

### 1. Start Chrome with Debug Port

```bash
mkdir -p ~/.telegpt/chrome-profiles/openai-creator
open -na "Google Chrome" --args \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.telegpt/chrome-profiles/openai-creator"
```

### 2. Manual Login

Open `https://chatgpt.com` in the Chrome window and login manually with Google OAuth.

### 3. Run CDP Attach Validation

```bash
pnpm creator:cdp:openai
```

### 4. Use in Execution Chain

The system automatically routes `openai_web`, `qwen_web`, and `deepseek_web` providers through CDP transport.

## Execution Flow

```
User Request
→ Router
→ Provider selected: openai_web
→ CDP transport attach
→ Session health check
→ Active tab resolve
→ Provider-specific adapter
→ Execution
→ Evidence / trace / result
```

## Provider Resolution

In `src/core/provider-resolution.ts`:

```typescript
openai_web: {
  provider: "openai_web",
  model: "gpt-4o",
  fallbackTo: ["creator", "local"],
  requiresCreatorMode: true,
  apiKeyEnv: undefined,  // No API key needed
}
```

## Fallback Chain

- `openai_web` → `creator` → `local`
- `qwen_web` → `creator` → `local`
- `deepseek_web` → `creator` → `local`

## Scripts

| Script                    | Description                         |
|---------------------------|-------------------------------------|
| `creator:cdp:openai`      | Validate CDP attach for OpenAI     |
| `creator:cdp:qwen`        | Validate CDP attach for Qwen       |
| `creator:cdp:deepseek`    | Validate CDP attach for DeepSeek   |
| `creator:live:openai`     | Live validation with session check |
| `creator:attach:openai`   | Attach to existing Chrome profile  |

## Health Monitoring

The CDP health monitor checks:

1. CDP endpoint accessibility
2. Browser context availability
3. Target tab existence
4. Session authentication state
5. Challenge/logout detection

## Error Handling

| State            | Action                          |
|------------------|--------------------------------|
| `login_required` | Cooldown 5min, fallback       |
| `challenge_detected` | Cooldown 5min, fallback    |
| `browser_unreachable` | Cooldown 1min, retry     |
| `alive`          | Continue execution             |

## Canonical Status

```text
openai_web:   EXTENSION BRIDGE ✅
qwen_web:     CDP BRIDGE ✅
deepseek_web: CDP BRIDGE ✅

Creator Web Bridge v2: OPERATIONAL ✅
```

## Next Steps

1. Integration into execution chain
2. Response capture for extension bridge
3. Unified router for provider transport selection