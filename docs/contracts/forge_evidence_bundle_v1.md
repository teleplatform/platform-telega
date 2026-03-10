artifact_id: contract_forge_evidence_bundle_v1
status: FIXED
owner: Tele•Ga / Sigma Forge Core
scope: Forge Evidence Bundle Format
created_at: 2026-03-10
classification: Evidence Contract

# FORGE EVIDENCE BUNDLE v1

## 1. Purpose

This document defines the canonical evidence bundle format for Sigma Forge executions.

The bundle is the authoritative execution proof for audit, replay, and compliance.

---

## 2. Core Rule

Canonical rule:

No task is complete without a sealed evidence bundle.

---

## 3. Bundle Structure

Top-level structure:

```json
{
  "trace_id": "string",
  "task_id": "string",
  "run_id": "string",
  "created_at": "ISO-8601",
  "outcome": "done|partial|blocked|failed",
  "artifacts": {},
  "policy": {},
  "tools": {},
  "verification": {},
  "integrity": {}
}
```

---

## 4. Required Sections

## 4.1 Artifacts

```json
{
  "plan_ref": "string",
  "patch_ref": "string",
  "critique_ref": "string",
  "test_report_ref": "string",
  "policy_decision_ref": "string"
}
```

## 4.2 Policy

```json
{
  "decision": "ALLOW|DENY|CONSENT_REQUIRED",
  "policy_refs": ["string"],
  "approved_by": "string|null",
  "timestamp": "ISO-8601"
}
```

## 4.3 Tools

```json
{
  "invocations": [
    {
      "tool": "string",
      "action": "string",
      "status": "ok|error",
      "timestamp": "ISO-8601"
    }
  ]
}
```

## 4.4 Verification

```json
{
  "status": "pass|fail|partial",
  "checks": [
    {
      "name": "string",
      "status": "pass|fail|skip"
    }
  ]
}
```

## 4.5 Integrity

```json
{
  "input_hash": "string",
  "output_hash": "string",
  "bundle_hash": "string",
  "sealed": true
}
```

---

## 5. Trace Requirements

Each bundle must support:
- retrieval by `trace_id`
- ordered step timeline
- linkage to all protocol artifacts
- immutable post-seal state

---

## 6. Storage and Retention

- store in evidence repository by `task_id/trace_id`
- enforce retention policy by environment
- allow legal hold for compliance contexts

---

## 7. Validation Rules

Bundle is valid only if:
- all required refs are present
- policy section exists
- verification section exists
- integrity hashes are present
- `sealed = true`

---

## 8. Conformance

A Forge system conforms only if:
- evidence bundle emitted for each run
- bundle schema is enforced
- post-seal immutability is guaranteed
- trace retrieval is available

---

## 9. Final Contract Statement

Forge evidence bundle is the legal and operational record of execution.
If it is missing, the run is non-canonical.
