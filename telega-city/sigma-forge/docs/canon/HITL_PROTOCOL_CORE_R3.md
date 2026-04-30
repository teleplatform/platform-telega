# HITL PROTOCOL CORE R3

**Статус:** `IMPLEMENTATION_SPEC`
**Модуль:** `telega-city/sigma-forge/packages/runtime-hitl-core`
**Роль:** handoff-protocol + human-decision + resume-to-runtime

---

## Purpose

Формальный human-in-the-loop слой для Sigma Forge / Tele•Ga:
- structured handoff packet (не хаос, а пакет)
- 7 handoff reason codes (RISK_HIGH, APPROVAL_REQUIRED, POLICY_BLOCK, CONFIDENCE_LOW, COMMERCIAL_DECISION, MANUAL_REVIEW_REQUIRED, USER_INPUT_REQUIRED)
- 6 human decision actions (approve/edit/reject/reroute/escalate/takeover)
- decision validation (edit требует replacement_output, reroute требует target)
- resume-to-runtime после решения человека
- full audit trail

---

## Architecture

```
Execution Runtime
→ risk / policy / confidence checkpoint
→ Handoff Packet (7 reason codes)
→ Human Decision (6 actions)
→ Decision Validation
→ Resolution (next_task_status + next_action)
→ Resume to Runtime / Cancel / Reroute / Takeover
→ Final Delivery
```

---

## Modules

| Module | Files |
|--------|-------|
| Handoff Protocol | handoffReasons, handoffPacket, handoffClassifier, handoffProtocol |
| Human Decision | decisionTypes, decisionValidation, decisionResolver, humanDecisionCore |
| Resume Core | resumeResolver, runtimeResume |
| Storage | schema.sql (4 tables), handoffsRepo, decisionsRepo, deliveriesRepo |

---

## Handoff Reason Codes

| Code | When |
|------|------|
| RISK_HIGH | High-risk execution detected |
| APPROVAL_REQUIRED | Policy requires human approval |
| POLICY_BLOCK | Policy blocked execution |
| CONFIDENCE_LOW | Confidence < 0.3 |
| COMMERCIAL_DECISION | Commercial/business decision needed |
| MANUAL_REVIEW_REQUIRED | Manual review flagged |
| USER_INPUT_REQUIRED | User input needed to continue |

---

## Human Decision Actions

| Action | Result | Validation |
|--------|--------|------------|
| approve | → running (resume) | No extra fields required |
| edit | → running (resume with edits) | Requires replacement_output |
| reject | → cancelled | No extra fields required |
| reroute | → planning | Requires reroute_target |
| escalate | → waiting_human | Requires editor_notes |
| takeover | → completed (manual) | No extra fields required |

---

## Decision Resolution Matrix

| Decision | next_task_status | next_action |
|----------|-----------------|-------------|
| approve | running | resume |
| edit | running | resume |
| reject | cancelled | cancel |
| reroute | planning | reroute |
| escalate | waiting_human | stay_waiting |
| takeover | completed | manual_takeover |

---

## SQLite Schema

- `runtime_handoffs` — handoff packet with completed steps, blocked reason, risk flags, rejected options
- `runtime_human_decisions` — human decision with action, editor_notes, replacement_output, reroute_target
- `runtime_handoff_resolutions` — resolution with next_task_status, next_action, notes
- `runtime_hitl_audit` — full audit trail for handoff → decision → resolution chain

---

## Definition of Done

- ✅ runtime-hitl-contracts package
- ✅ runtime-hitl-core package
- ✅ handoff-protocol-core (reasons, packet, classifier, protocol)
- ✅ human-decision-core (validation, resolver, record)
- ✅ resume-to-runtime-core (resumeResolver, runtimeResume)
- ✅ SQLite schema + repos (4 tables)
- ✅ Unit tests: 20 passed, 0 failed
- ✅ Integration tests: 10 passed, 0 failed
