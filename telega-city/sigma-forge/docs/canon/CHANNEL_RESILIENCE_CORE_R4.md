# CHANNEL RESILIENCE CORE R4

**Статус:** `IMPLEMENTATION_SPEC`
**Модуль:** `telega-city/sigma-forge/packages/runtime-channel-core`
**Роль:** channel-adapter-contract + transport-failover + session-replay-core

---

## Purpose

Устойчивость к падению транспорта для Sigma Forge / Tele•Ga:
- channel-agnostic runtime (telegram/web/miniapp/tgm/max)
- unified inbound/outbound event contract
- channel binding (tele_user_id → transport mapping)
- transport failover (priority: tgm → web → miniapp → telegram → max)
- session replay / recovery
- failover audit trail

---

## Architecture

```
Inbound Raw Channel Event
→ Adapter normalize → UnifiedInboundEvent
→ Identity projection → tele_user_id
→ Channel binding resolution
→ R1 Safety / Policy / Compliance
→ R2 Economics / Provider / Budget
→ R3 HITL (if needed)
→ FSGR Planning / Execution
→ Outbound Adapter → Channel Reply
→ Replay update / Transport event log
→ Failover / Recovery when channel unavailable
```

---

## Modules

| Module | Files |
|--------|-------|
| Adapter Registry | adapterRegistry (create, register, get, list) |
| Channel Binding | channelBinding (create, resolvePrimary, resolveByUser, resolveByTransport) |
| Transport Failover | transportFailover (decideTransportFailover, buildReplaySummary, FAILOVER_PRIORITY) |
| Storage | schema.sql (4 tables) |

---

## Unified Transports

| Transport | Priority |
|-----------|----------|
| tgm | 1 (highest) |
| web | 2 |
| miniapp | 3 |
| telegram | 4 |
| max | 5 |

---

## Failover Decision Matrix

| Condition | Result |
|-----------|--------|
| Current transport available | No failover needed |
| Current unavailable, next available | Failover to next priority, replay_required=true |
| No transport available | Failover denied, reasons: no_available_transport |

---

## SQLite Schema

- `runtime_channel_bindings` — tele_user_id → transport mapping, primary flag
- `runtime_replay_states` — session replay state with continuity summary
- `runtime_transport_events` — inbound/outbound event log per transport
- `runtime_failover_audit` — failover decision audit trail

---

## Definition of Done

- ✅ runtime-channel-contracts package
- ✅ runtime-channel-core package
- ✅ channel-adapter-contract (registry with duplicate prevention)
- ✅ channel-binding (create, resolve primary, resolve by user/transport)
- ✅ transport-failover (priority-based decision, replay summary)
- ✅ SQLite schema (4 tables)
- ✅ Unit tests: 12 passed, 0 failed
