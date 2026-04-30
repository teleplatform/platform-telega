# ALICE POST-LAUNCH CONTROL CHECKLIST v1.0

## Purpose

This checklist confirms that the Arisha Alice skill is **operating under live control** after launch.
It is NOT a guarantee of user success — only that operational state, health, and anomalies are visible and manageable.

---

## Current State

| Field | Value |
|-------|-------|
| Live State | `live` / `degraded` / `held` / `disabled` / `unknown` |
| State Source | `operator` / `health` / `launch` / `fallback` |
| Health | `healthy` / `degraded` / `unknown` |
| Last Updated | __________ |

---

## Health Checks

- [ ] **Ingress alive** — HTTP entry endpoint reachable and responding
- [ ] **Protocol alive** — Protocol adapter processing requests
- [ ] **Bridge alive** — Bridge adapter handling voice sessions
- [ ] **Safe fallback available** — Fallback path functional and tested

---

## Anomaly Review

- [ ] **No high-severity anomalies** — If present, system should be degraded
- [ ] **Medium anomalies reviewed** — Operator awareness of degradation signals
- [ ] **Low anomalies monitored** — Repeated low may indicate emerging issues

### Active Anomalies

<!-- List any active anomaly signals -->

- [ ] No active high-severity anomalies
- [ ] Medium anomalies reviewed and accepted

---

## Fallback Review

- [ ] **Fallback path confirmed working** — Safe error responses return bounded JSON
- [ ] **Fallback not overused** — Repeated fallback usage indicates degraded operation
- [ ] **Fallback ≠ healthy** — Using fallback does NOT mean system is healthy

---

## Operator Action Guidance

### Current recommended action:
☐ **None** — Continue normal operations  
☐ **Hold** — Temporarily pause live surface  
☐ **Degrade** — Switch to limited safe mode  
☐ **Disable** — Intentionally stop live surface  
☐ **Resume** — Return to live from held/degraded

### Action notes:

<!-- Record operator decision and reasoning -->

---

## Post-Launch Notes

<!-- Any observations about live behavior -->

- [ ] Notes filled

---

## Sign-Off

- Operator: __________
- Date: __________
- Action taken: ☐ None / ☐ Hold / ☐ Degrade / ☐ Disable / ☐ Resume
- Next review date: __________
