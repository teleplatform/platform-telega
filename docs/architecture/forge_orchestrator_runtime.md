artifact_id: architecture_forge_orchestrator_runtime_v1
status: FIXED
owner: Tele•Ga / Sigma Forge Core
scope: Forge Orchestrator Runtime
created_at: 2026-03-10
classification: Runtime Architecture

# FORGE ORCHESTRATOR RUNTIME v1

## 1. Purpose

This document defines the runtime architecture for orchestrating multi-agent development inside Sigma Forge.

---

## 2. Runtime Topology

Canonical flow:

Task Ingress  
→ Task Queue  
→ Agent Scheduler  
→ Workspace Manager  
→ Agent Workers  
→ Artifact Bus  
→ Verifier/Policy Gates  
→ Evidence Writer  
→ Result Egress

---

## 3. Core Components

## 3.1 Task Queue

Responsibilities:
- receive task envelopes
- prioritize by policy and SLA
- handle retries and dead-letter

## 3.2 Agent Scheduler

Responsibilities:
- assign role-specific agents per stage
- enforce execution order
- manage concurrency and timeouts

## 3.3 Artifact Bus

Responsibilities:
- route structured artifacts between stages
- validate schema before dispatch
- maintain artifact lineage by `trace_id`

## 3.4 Workspace Manager

Responsibilities:
- create isolated workspace/worktree
- mount scoped inputs
- seal evidence outputs
- clean up on completion/failure

## 3.5 Worker Execution

Responsibilities:
- run planner/developer/critic/verifier workers
- execute tools via Tool Gateway
- emit stage artifacts only

---

## 4. Stage State Machine

Canonical stage order:

1. `planned`
2. `implemented`
3. `critiqued`
4. `verified`
5. `policy_checked`
6. `evidence_sealed`
7. `completed` or `blocked` or `failed`

No stage skipping is allowed without policy override.

---

## 5. Worktree Execution Model

- each task gets isolated worktree/workspace
- patches are applied only inside task boundary
- merge/promotion happens only after verifier + policy pass

---

## 6. Failure Handling

Failure classes:
- queue_failure
- agent_timeout
- artifact_invalid
- verification_failed
- policy_denied
- tool_gateway_error

Recovery options:
- bounded retry
- rollback to previous stage artifact
- human escalation for high-risk tasks

---

## 7. Observability

Required telemetry:
- per-stage latency
- queue wait time
- retry counts
- policy deny rate
- pass/fail verification rates
- evidence emission completeness

---

## 8. Conformance

A runtime conforms only if it supports:
- task queue and scheduler
- artifact bus with schema validation
- isolated workspace/worktree execution
- verifier and policy gates
- evidence emission per task

---

## 9. Final Architecture Statement

Forge runtime is a controlled orchestration engine, not a chat loop.
Execution integrity depends on staged agents, artifact handoffs, and governed promotion.
