artifact_id: canon_workspace_engine_v1
status: FIXED
owner: Tele•Ga / Tele•GPT Core
scope: Workspace Engine
created_at: 2026-03-08
classification: Core Isolation Canon

# WORKSPACE ENGINE CANON v1

## 1. Purpose

This document defines the canonical workspace engine for Tele•GPT.

Workspaces provide isolated execution environments for agent tasks and artifacts.

---

## 2. Canonical Workspace Layout

Recommended structure:

workspace/
  input/
  docs/
  assets/
  output/
  logs/
  evidence/

Canonical rule:

All task artifacts must remain inside workspace scope unless explicitly exported by policy.

---

## 3. Core Rules

- workspace access is deny-by-default outside scope
- writes are allowed only inside approved workspace root
- destructive operations require elevated policy
- workspace lifecycle is tied to task lifecycle

---

## 4. Lifecycle

Canonical lifecycle:
1. create
2. mount / initialize
3. operate
4. validate
5. archive or cleanup
6. revoke access

---

## 5. Isolation and Safety

Required safety controls:
- path boundary enforcement
- connector and secret isolation by scope
- environment separation (sandbox/staging/production)
- immutable evidence area after seal

---

## 6. Audit

Workspace actions must emit:
- trace_id
- workspace_id
- actor_id or agent_role
- operation
- file/path target
- decision
- timestamp

---

## 7. Conformance

A workspace engine is canonical only if it supports:
- scoped filesystem boundaries
- deterministic layout
- lifecycle controls
- policy-aware access checks
- auditable operations

---

## 8. Final Canon Statement

Tele•GPT workspaces are controlled execution capsules.
No core agent execution is canonical without workspace isolation.
