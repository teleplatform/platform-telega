# ALICE PUBLISH CHECKLIST v1.0

## Purpose

This checklist confirms that the Arisha Alice skill is structurally ready for external publication.
It does NOT guarantee production success — only that the skill meets launch-readiness criteria.

---

## Pre-Publish Checks

- [ ] **Manifest ready** — `configs/alice-skill.manifest.json` exists, is valid JSON, contains identity + invocation + endpoint
- [ ] **Endpoint confirmed** — Webhook path declared: `/api/v1/alice/webhook`
- [ ] **Environment configured** — Required env vars present (at minimum `ALICE_WEBHOOK_PATH`)
- [ ] **Secret mode confirmed** — If `ALICE_SECRET_MODE=enabled`, then `ALICE_SHARED_SECRET` is set
- [ ] **Ingress hardening enabled** — Hardening layer active before protocol handoff
- [ ] **Local smoke pass** — All unit tests pass (run `npx tsx tests/unit/alice-publish/alice-publish-skill-registration-pack.test.ts`)
- [ ] **Pre-publish validation pass** — `prepareAliceSkillRegistration()` returns `readyToPublish: true`

---

## Blockers (must be resolved before publish)

<!-- List any blockers from the readiness report -->

- [ ] No unresolved blockers in readiness report

---

## Warnings (should be reviewed before publish)

<!-- List any warnings from the readiness report -->

- [ ] Warnings reviewed and accepted

---

## Notes

<!-- Additional publish notes -->

- [ ] Notes filled

---

## Publish Decision

| Field | Value |
|-------|-------|
| Skill ID | `arisha_alice_skill_v1` |
| Version | `1.0.0` |
| Ready to Publish | ☐ Yes / ☐ No |
| Manifest Path | `configs/alice-skill.manifest.json` |
| Endpoint Path | `/api/v1/alice/webhook` |
| Primary Language | `ru` |
| Supported Languages | `ru`, `en`, `uz` |

---

## Sign-Off

- Reviewed by: __________
- Date: __________
- Decision: ☐ Publish / ☐ Hold / ☐ Reject
