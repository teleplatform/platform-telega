artifact_id: canon_evidence_bundle_v1
status: FIXED
owner: Tele•Ga / Tele•GPT Core
scope: Evidence Bundle
created_at: 2026-03-08
classification: Core Observability Canon

# EVIDENCE BUNDLE CANON v1

## 1. Purpose

This document defines the canonical Evidence Bundle for Tele•GPT executions.

Evidence bundles make agent actions auditable, replayable, and defensible.

---

## 2. Core Rule

Canonical rule:

No significant agent action is complete without evidence emission.

---

## 3. Required Fields

Every evidence bundle must include:
- trace_id
- step_id
- task_id
- actor_id or agent_role
- policy_verdict
- tool_invocation_refs
- input_hash
- output_hash
- timestamps
- outcome_state

---

## 4. Optional Fields

Recommended extensions:
- model_route
- cost_summary
- warning_list
- validator_results
- rollback_hints

---

## 5. Evidence Lifecycle

1. initialize bundle at execution start
2. append step records during execution
3. seal bundle on completion/failure
4. store in immutable evidence store
5. expose retrieval API by trace_id

---

## 6. Integrity Rules

- hash inputs and outputs
- prevent silent post-seal mutation
- maintain chain-of-events ordering
- link policy and permission decisions

---

## 7. Conformance

A runtime is canonical only if it supports:
- mandatory evidence bundle emission
- trace-linked step records
- integrity controls
- retrieval by trace_id

---

## 8. Final Canon Statement

Tele•GPT must be able to prove what happened, why, and under which policy.
Evidence is a first-class system output, not a debug extra.
