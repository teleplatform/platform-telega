# Tele•GPT API Errors (Stable Contract)

This document describes the stable error response format and common error cases.

## A) Error Response Contract (all non-2xx)

JSON body (always present):
- `error` (string): stable machine code.
- `message` (string): short human-readable description.
- `ts` (string): ISO timestamp.

Optional fields:
- `hint` (string): what to configure / how to fix.
- `provider` (string): provider name when applicable (`openai` or `local`).

Headers (when set):
- `x-error-code`: error code (matches `error` or the primary internal code).
- `x-used-provider`: selected provider (`openai` or `local`).

## B) Error Catalog

### 503 NO_PROVIDER_CONFIGURED
When: no provider is configured (missing `OPENAI_API_KEY` and missing `LOCAL_OPENAI_BASE_URL` + `LOCAL_OPENAI_MODEL`).

Example:
```json
{
  "error": "NO_PROVIDER_CONFIGURED",
  "message": "No LLM provider configured",
  "hint": "Set OPENAI_API_KEY or LOCAL_OPENAI_BASE_URL + LOCAL_OPENAI_MODEL",
  "ts": "<ISO>"
}
```

### 502 PROVIDER_UNAVAILABLE
When: provider is selected but the upstream call fails (e.g., connection refused, 401, timeout).

Example:
```json
{
  "error": "PROVIDER_UNAVAILABLE",
  "provider": "local",
  "message": "Provider unavailable",
  "ts": "<ISO>"
}
```

### 429 RATE_LIMITED (may be returned)
When: rate limits, queue limits, or concurrency limits are exceeded.

Example (shape may vary):
```json
{
  "error": "RATE_LIMITED",
  "message": "Rate limited",
  "ts": "<ISO>"
}
```

### 400 BAD_REQUEST
When: invalid JSON or missing required request fields.

Example (shape may vary):
```json
{
  "error": "BAD_REQUEST",
  "message": "Bad request",
  "ts": "<ISO>"
}
```

### 503 CLOSING (health/ready)
When: server is shutting down (`/health` or `/ready`).

`/health` example:
```json
{
  "ok": false,
  "service": "tele-gpt",
  "closing": true,
  "env": "dev",
  "uptime_s": 123,
  "ts": "<ISO>"
}
```

`/ready` example:
```json
{
  "ready": false,
  "service": "tele-gpt",
  "closing": true,
  "env": "dev",
  "ts": "<ISO>"
}
```
