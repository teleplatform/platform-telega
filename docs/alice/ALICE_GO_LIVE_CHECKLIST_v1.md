# ALICE GO-LIVE CHECKLIST v1.0

## Purpose

This checklist confirms that the Arisha Alice skill is ready for **controlled external launch**.
It is NOT a guarantee of user success — only that launch gates and smoke checks are satisfied.

---

## Pre-Launch Gates

- [ ] **Readiness confirmed** — `prepareAliceSkillRegistration()` returned `readyToPublish: true`
- [ ] **Launch mode selected** — Mode explicitly chosen: `dry_run` / `internal_only` / `controlled_live`
- [ ] **Gates passed** — All 5 gate checks passed (publish readiness, endpoint, hardening, protocol, webhook)
- [ ] **Smoke passed** — All 4 smoke checks passed (ingress, protocol mapping, bridge, error path)

---

## Rollback & Hold

- [ ] **Rollback path confirmed** — Rollback decision path defined for failed/smoke_failed states
- [ ] **Hold path confirmed** — Manual hold path available for operator pause
- [ ] **Rollback reason documented** — If rolling back, reason is recorded

---

## Operator Decision

- [ ] **Go/No-Go decided** — Operator explicitly decided: ☐ Go / ☐ Hold / ☐ Rollback
- [ ] **Launch state recorded** — Current state: `not_started` / `gated` / `smoke_failed` / `live` / `held` / `rolled_back` / `failed`
- [ ] **Health snapshot taken** — Health status recorded: `healthy` / `degraded` / `unknown`

---

## Launch Decision Table

| Field | Value |
|-------|-------|
| Launch ID | `alice-launch-001` |
| Skill ID | `arisha_alice_skill_v1` |
| Mode | `dry_run` / `internal_only` / `controlled_live` |
| Target Surface | `alice` |
| Gates Passed | ☐ Yes / ☐ No |
| Smoke Passed | ☐ Yes / ☐ No |
| Rollback Allowed | ☐ Yes / ☐ No |
| Go-Live Decision | ☐ Go / ☐ Hold / ☐ Rollback |
| Health Status | `healthy` / `degraded` / `unknown` |

---

## Post-Launch Notes

<!-- Any observations after launch decision -->

- [ ] Notes filled

---

## Sign-Off

- Launch operator: __________
- Date: __________
- Decision: ☐ Go / ☐ Hold / ☐ Rollback
- Next review date: __________
