# Release v0.2.1-canon

This release locks Tele•GPT core runtime as a reproducible, server-first build.

## Highlights
- G2F core module is tracked in git (no “works locally” drift).
- KB-2: SQLite knowledge packs with CAS (expected_version), etag, endpoints, and live overrides.
- INTENT-2: hybrid keyword + LLM intent detection with strict <json> contract and trace attribution.
- Guardrail: actionability gate for auto task generation.
- Build stabilized: `npm run build` compiles only server/runtime (via `tsconfig.server.json`).

## Smoke commands
- `npm run smoke:kb2`
- `npm run smoke:tasks`
- `npm run smoke:local-provider` (requires LOCAL_OPENAI_BASE_URL to be reachable)
