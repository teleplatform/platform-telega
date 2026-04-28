# Creator Bridge Baseline Lock v1

Status: WORKING / LOCKED

## Providers

- **chatgpt_web** ✅
- **qwen_web** ✅

## Verified behavior

- Telegram → OpenAI Web → ChatGPT browser session works.
- Telegram → Qwen Web → Qwen browser session works.
- CDP attach works on port 9222.
- Message input works through focused composer + Enter.
- Extraction works via page.evaluate + DOM polling.
- Empty extraction is treated as failure.

## Canonical extractor pattern

Playwright locator is not trusted for streamed assistant output.

Use:

1. Poll until the last assistant message has non-empty text.
2. Extract with `page.evaluate()`.
3. Verify non-empty before returning.

**ChatGPT**: `[data-message-author-role="assistant"]`
**Qwen**: `[class*="message-assistant"]`

## Verified tests

### ChatGPT
- `Say hi` → `Hi 👋` (5 chars)
- `What is 2+2?` → non-empty assistant response

### Qwen
- `Say hi` → `Приветствую` (11 chars)
- `2+2=?` → `2+2 = 4`

## Canon

WAIT → VERIFY → EXTRACT

Not:

FIND → READ