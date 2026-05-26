# KCA Mission Control RC-2

Status: Draft Release Candidate
Version tag: `v1.1.0-rc.2` later
Date: 2026-05-21
Scope: Real Mission Control Activation

## Goal

```text
production-ready living loop
→ real Mission Control surface
```

RC-2 wires Mission Control onto the existing production-ready living loop. It does not introduce a new KCA layer.

## Included

- RC2-1 Telegram live feed sender with dry-run fallback.
- RC2-2 readable high/critical incident Telegram alerts.
- RC2-3 inline approval buttons for replay, execution, and incident approvals.
- RC2-4 stable dashboard endpoint: `GET /api/runtime/mission-control`.
- RC2-5 CLI snapshot command: `npm run mission:control`.
- RC2-6 Telegram config validator with optional test send.
- RC2-7 Mission Control smoke test.

## Commands

Mission Control snapshot:

```bash
npm run mission:control
```

JSON snapshot:

```bash
npm run mission:control -- --json
```

Telegram config validation:

```bash
npm run mission:control -- --validate --send-test --json
```

Smoke test:

```bash
npm run test:mission-control
```

Dashboard route:

```text
GET /api/runtime/mission-control
GET /api/runtime/mission-control?send_test=true
```

## Telegram Config

Required for live sending:

```text
TELEGRAM_MISSION_CONTROL_ENABLED=true
TELEGRAM_MISSION_CONTROL_DRY_RUN=false
TELEGRAM_MISSION_CONTROL_BOT_TOKEN=<bot token>
TELEGRAM_MISSION_CONTROL_CHAT_ID=<chat id>
```

Dry-run fallback:

```text
TELEGRAM_MISSION_CONTROL_DRY_RUN=true
```

When dry-run is enabled, the sender records Mission Control evidence and logs the intended Telegram message without requiring a bot token.

## Release Note

RC-2 tag is reserved for later:

```text
v1.1.0-rc.2
```

Promotion requires green Mission Control smoke plus existing production activation checks.
