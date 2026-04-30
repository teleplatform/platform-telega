# ALICE INCIDENT RECOVERY RUNBOOK v1.0

## Purpose

This runbook guides operators through incident classification, recovery execution, and safe restoration.
It is NOT an automated repair system — it provides disciplined, operator-visible recovery discipline.

---

## 1. Incident Review

| Field | Value |
|-------|-------|
| Incident ID | __________ |
| Created At | __________ |
| Status | `suspected` / `confirmed` / `recovering` / `resolved` / `failed` |
| Severity | `low` / `medium` / `high` / `critical` |
| Trigger | `ingress_failure` / `protocol_failure` / `bridge_failure` / `unsafe_response_path` / `repeated_fallback` / `manual_operator_action` / `unknown` |

---

## 2. Severity Review

- [ ] **Low severity** — Monitoring recommended, no immediate action required
- [ ] **Medium severity** — Operator review advised, potential degradation
- [ ] **High severity** — Immediate attention required, system may be compromised
- [ ] **Critical severity** — Emergency response needed, system integrity at risk

### Severity determination basis:

<!-- Record what led to severity classification -->

---

## 3. Anomaly Source Review

- [ ] **Ingress unreachable** — HTTP entry point not responding
- [ ] **Protocol failure** — Protocol adapter processing failure
- [ ] **Bridge failure** — Bridge adapter voice session handling failure
- [ ] **Unsafe response path** — Response may leak internals or behave unsafely
- [ ] **Repeated fallback** — Fallback usage indicates degraded operation

### Active anomaly signals:

<!-- List any active anomaly signal IDs -->

---

## 4. Recovery Playbook Selection

Select applicable playbook based on trigger:

| Trigger | Primary Playbook |
|---------|-----------------|
| `ingress_failure` | `recheck_ingress` |
| `protocol_failure` | `recheck_protocol` |
| `bridge_failure` | `recheck_bridge` |
| `repeated_fallback` | `fallback_containment` |
| `unsafe_response_path` | `safe_hold` |
| `manual_operator_action` | `manual_disable` |

### Selected playbook:

- [ ] Playbook ID: __________
- [ ] Description: __________
- [ ] Execution steps followed

---

## 5. Recovery Outcome Review

| Field | Value |
|-------|-------|
| Recovery Attempted | ☐ Yes / ☐ No |
| Outcome | `not_attempted` / `recovered` / `partially_recovered` / `failed` |
| Restored State | `live` / `degraded` / `held` / `disabled` / `unknown` |

### Recovery notes:

<!-- Record recovery execution details -->

---

## 6. Restoration Gate Checklist

Before restoring to live, ALL must pass:

- [ ] **Clean incident state** — Incident not `active` or `failed_recovery`
- [ ] **Successful recovery** — Recovery outcome not `failed`
- [ ] **Health checks green** — All 4 health checks passing (ingress, protocol, bridge, fallback)
- [ ] **Operator approval** — Explicit operator acceptance of restoration

### Restoration decision:

☐ **Restore to live** — All gates passed  
☐ **Remain degraded** — Some gates not met  
☐ **Remain held** — Operator pause required  
☐ **Remain disabled** — Critical issues unresolved  

---

## 7. Incident Sign-Off

- Operator: __________
- Date: __________
- Final status: ☐ Resolved / ☐ Failed / ☐ Partially Resolved
- Lessons learned: __________
- Next review date: __________
