# Creator Bridge Baseline Lock v1

Status: WORKING / LOCKED

## Verified behavior

- Telegram → OpenAI Web → ChatGPT browser session works.
- CDP attach works on port 9222.
- Message input works through focused composer + Enter.
- Extraction works via page.evaluate + DOM polling.
- Empty extraction is treated as failure.

## Canonical extractor pattern

Playwright locator is not trusted for streamed assistant output.

Use:

1. Poll until the last `[data-message-author-role="assistant"]` has non-empty text.
2. Extract with `page.evaluate()`.
3. Verify non-empty before returning.

## Verified tests

- `Say hi` → `Hi 👋`
- `What is 2+2?` → non-empty assistant response

## Canon

WAIT → VERIFY → EXTRACT

Not:

FIND → READ