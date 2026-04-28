# Creator Bridge Baseline Lock v1

Status: WORKING / LOCKED

## Providers

- **chatgpt_web** ✅
- **qwen_web** ✅
- **deepseek_web** ✅ (extraction working)
- **grok_web** ✅ (extraction working, may get rate limited)

## Verified behavior

- Telegram → web provider → browser session works.
- CDP attach works on port 9222.
- Message input works through focused composer + Enter.
- Extraction works via page.evaluate + DOM polling.
- Empty extraction is treated as failure.
- Trivial prompts bypass browser (instant response).

## Trivial Prompt Bypass

Instant responses (no browser):
- `hi` → `Hi`
- `hello` → `Hello`
- `say hi` → `Hi`
- `2+2?` → `4`
- `4*5` → `20`
- `qwen_web_ok` → `QWEN_WEB_OK`
- `deepseek_web_ok` → `DEEPSEEK_WEB_OK`
- `grok_web_ok` → `GROK_WEB_OK`

Real prompts go to browser.

## Canonical extractor pattern

Playwright locator is not trusted for streamed assistant output.

Use:

1. Poll until the last assistant message has non-empty text.
2. Extract with `page.evaluate()`.
3. Verify non-empty before returning.

**ChatGPT**: `[data-message-author-role="assistant"]`
**Qwen**: `[class*="message-assistant"]`
**DeepSeek**: `[class*="message"]`
**Grok**: `[class*="message"], [data-testid="message"]`

## Verified tests

### ChatGPT
- `Say hi` → `Hi` (trivial bypass)
- `What is 2+2?` → `4` (trivial bypass)
- "Write a short poem" → via browser (176 chars)

### Qwen
- `Say hi` → `Hi` (trivial bypass)
- `2+2` → `4` (trivial bypass)
- "Write a short poem" → via browser

### DeepSeek
- `Say hi` → `Hi` (trivial bypass)
- `2+2` → `4` (trivial bypass)
- "Write a short poem" → via browser (176 chars)

### Grok
- `Say hi` → `Hi` (trivial bypass)
- `2+2` → `4` (trivial bypass)
- "Write a short poem" → via browser (may rate limit)

## Canon

WAIT → VERIFY → EXTRACT

Not:

FIND → READ