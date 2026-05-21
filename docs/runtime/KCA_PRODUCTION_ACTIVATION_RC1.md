# KCA Civilization Stack — Production Activation RC-1

Status: Release Candidate
Version tag: `v1.1.0-rc.1`
Package version: `1.1.0-rc.1`
Date: 2026-05-21
Milestone: Production Activation v1

## Summary

KCA Civilization Stack has reached Production Activation RC-1.

```text
Living loop
→ tested
→ auditable
→ CI-gated
→ production-ready
```

Production readiness is backed by:

- A21-A28 living-loop hardening suite: `8/8 passed`.
- A29-A36 production-readiness suite: `7/7 passed`.
- TypeScript build: passed.
- Production activation freeze: `.data/civilization/production-activation-freeze.json`.
- Freeze status: `production_ready: true`.

## Production Activation Freeze

Freeze artifact:

```text
.data/civilization/production-activation-freeze.json
```

Freeze details:

```text
artifact_id: production_activation_freeze
milestone: A36
trace_id: 88b6f4549809b970
production_ready: true
```

Trace inspection confirmed required loop phases:

```text
preflight: present
decision_point: present
budget: present
execution: present
closure: present
missing: none
```

## Mission Control Summary

Mission Control state for RC-1:

- Living loop evidence chain is complete.
- Budget consistency audit passed.
- Mode boundary audit passed.
- Burn rate anomaly list is empty in the production freeze.
- CI now gates the living-loop hardening suite.
- Trace inspector can show the live-loop path by `trace_id`.

Inspection command:

```bash
npm run trace:inspect -- --trace 88b6f4549809b970 --living-loop --json
```

## Activation Commands

Run production activation verification:

```bash
npm run test:production-readiness
npm run test:living-loop-hardening
npm run build
```

Inspect operational loop snapshot:

```bash
npm run trace:inspect -- --operational-loop --json
```

Inspect the RC-1 production trace:

```bash
npm run trace:inspect -- --trace 88b6f4549809b970 --living-loop --json
```

## Known Risks

- The production freeze records the runtime state at freeze time; future runtime evidence growth requires a new freeze before promoting beyond RC.
- Mission Control Telegram delivery remains dry-run unless configured with live sender credentials.
- Governance failure matrix depends on recorded evidence in the active evidence store; a clean store may show zero historical failures.
- Budget/mode audits currently assert known hook contracts; new risky hooks must be added to the audit table before release promotion.
- Existing dirty workspace state should be reviewed before final tag creation.

## Rollback Note

Rollback target:

```text
v1.0.0
```

Rollback procedure:

```bash
git checkout v1.0.0
npm ci
npm run build
```

If the RC has already been deployed, disable production activation by reverting the RC changes and restoring the last known stable runtime freeze. Do not delete evidence records; preserve them for post-rollback inspection.

## Release Checklist

- [x] Version tag selected: `v1.1.0-rc.1`.
- [x] Changelog updated.
- [x] Production activation freeze created.
- [x] Known risks documented.
- [x] Rollback note documented.
- [x] Activation commands documented.
- [x] Mission Control summary documented.

## RC-1 Decision

```text
KCA Civilization Stack
→ Production Activation
→ RC-1 Release Candidate
```

Decision: RC-1 is ready for operator review and tag creation.
