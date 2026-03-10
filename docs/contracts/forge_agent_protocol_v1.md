artifact_id: contract_forge_agent_protocol_v1
status: FIXED
owner: Tele•Ga / Sigma Forge Core
scope: Forge Agent Artifact Protocol
created_at: 2026-03-10
classification: Execution Contract

# FORGE AGENT PROTOCOL v1

## 1. Purpose

This document defines the canonical artifact protocol for multi-agent execution in Sigma Forge.

Canonical rule:

Agents must communicate through structured artifacts, not raw conversation.

---

## 2. Artifact Types

Required artifact sequence:

1. `PLAN.json`
2. `PATCH.diff`
3. `CRITIQUE.md`
4. `TEST_REPORT.json`
5. `POLICY_DECISION.json`
6. `EVIDENCE_BUNDLE.json`

---

## 3. Producer Roles

- Planner Agent → `PLAN.json`
- Developer Agent → `PATCH.diff`
- Critic Agent → `CRITIQUE.md`
- Verifier Agent → `TEST_REPORT.json`
- Policy Gate → `POLICY_DECISION.json`
- Runtime/Evidence Layer → `EVIDENCE_BUNDLE.json`

---

## 4. Mandatory Shared Fields

Each artifact must include:

- `trace_id`
- `task_id`
- `artifact_id`
- `artifact_type`
- `produced_by`
- `timestamp`
- `schema_version`

---

## 5. Canonical Schemas

## 5.1 PLAN.json

```json
{
  "trace_id": "string",
  "task_id": "string",
  "goals": ["string"],
  "steps": [
    {
      "step_id": "string",
      "description": "string",
      "acceptance_criteria": ["string"],
      "risk_level": "low|medium|high|critical"
    }
  ],
  "constraints": ["string"]
}
```

## 5.2 PATCH.diff

```json
{
  "trace_id": "string",
  "task_id": "string",
  "summary": "string",
  "files_touched": ["string"],
  "diff_ref": "string",
  "tests_added": ["string"]
}
```

## 5.3 CRITIQUE.md

Must contain:
- findings by severity
- file/line references
- risk summary
- required fixes

## 5.4 TEST_REPORT.json

```json
{
  "trace_id": "string",
  "task_id": "string",
  "status": "pass|fail|partial",
  "checks": [
    {
      "name": "string",
      "status": "pass|fail|skip",
      "details": "string"
    }
  ],
  "coverage": {
    "lines": 0,
    "branches": 0
  }
}
```

## 5.5 POLICY_DECISION.json

```json
{
  "trace_id": "string",
  "task_id": "string",
  "decision": "ALLOW|DENY|CONSENT_REQUIRED",
  "reason": "string",
  "policy_refs": ["string"],
  "approved_by": "string|null"
}
```

## 5.6 EVIDENCE_BUNDLE.json

```json
{
  "trace_id": "string",
  "task_id": "string",
  "artifacts": ["string"],
  "policy_decision_ref": "string",
  "tool_logs_ref": "string",
  "hashes": {
    "input_hash": "string",
    "output_hash": "string"
  },
  "outcome": "done|partial|failed|blocked"
}
```

---

## 6. Handoff Rules

- No agent executes without required predecessor artifact.
- Artifact validation must pass schema before handoff.
- Any invalid artifact blocks downstream execution.

---

## 7. Conformance

A Forge runtime conforms only if:

- all six artifacts are supported
- schema validation is enforced
- handoffs are artifact-based
- each artifact is trace-linked

---

## 8. Final Contract Statement

Forge execution is artifact-first.
Conversation may assist agents, but artifacts are the source of truth.
