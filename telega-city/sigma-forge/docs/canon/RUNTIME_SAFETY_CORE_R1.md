# RUNTIME SAFETY CORE R1

**Статус:** `IMPLEMENTATION_SPEC`
**Модуль:** `telega-city/sigma-forge/packages/runtime-safety-core`
**Роль:** compliance-gateway + policy-engine + identity-and-scope-core

---

## Purpose

Обязательный safety-perimeter для Sigma Forge / Tele•Ga:
- compliance gateway (detect → classify → redact → policy)
- policy engine (agent-level tool/memory/action restrictions)
- identity & scope (runtime identity, channel-agnostic, scope bindings)

---

## Architecture

```
Inbound Event
→ Identity & Scope Core
→ Compliance Gateway
→ Policy Engine
→ Router / Supervisor / Agent Runtime
→ Tools / Providers / Channels
```

---

## Modules

| Module | Files |
|--------|-------|
| Compliance | detectSensitive, classifySensitivity, redactPayload, outboundPolicy, complianceGateway |
| Policy | policyEngine (registry + resolver + engine) |
| Identity | identityResolver (buildRuntimeIdentity, createScopeBinding, resolveRuntimeIdentity) |
| Storage | schema.sql, identitiesRepo, complianceAuditRepo |
| API | checkCompliance, resolvePolicy |

---

## Sensitivity Levels

| Level | Description |
|-------|-------------|
| public_safe | No sensitive data detected |
| internal_safe | Internal identifiers, CRM hints |
| provider_restricted | Data requiring masking before external |
| confidential | Personal/client/order data |
| regulated | Payment/secret/regulated data |

---

## Detection Patterns

- Email, phone, address fragments
- API keys / tokens / secrets
- Payment IDs / card numbers
- CRM identifiers
- Order IDs / internal refs

---

## Policy Rules

- denied_tools always win
- tool must be in allowlist if non-empty
- write to unlisted memory scope denied
- external send denied if sanitization required
- parallel jobs beyond limit denied

---

## SQLite Schema

- `runtime_identities` — user/workspace/store/session/agent/channel identity
- `runtime_policies` — agent-level tool/memory/approval policies
- `runtime_scope_bindings` — scope_id → identity binding
- `runtime_compliance_audit` — full audit trail for every compliance decision

---

## Definition of Done

- ✅ runtime-safety-contracts package
- ✅ runtime-safety-core package
- ✅ compliance-gateway (detect → classify → redact → policy)
- ✅ policy-engine (registry + resolver + engine)
- ✅ identity-and-scope-core (identity + scope binding + resolver)
- ✅ SQLite schema + repos
- ✅ API facades (checkCompliance, resolvePolicy)
- ✅ Audit trail
- ✅ Unit tests: 24 passed, 0 failed
- ✅ Integration tests: 5 passed, 0 failed
