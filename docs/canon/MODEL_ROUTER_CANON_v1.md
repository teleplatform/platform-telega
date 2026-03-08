artifact_id: canon_model_router_v1
status: FIXED
owner: Tele•Ga / Tele•GPT Core
scope: Model Router
created_at: 2026-03-08
classification: Core Intelligence Canon

# MODEL ROUTER CANON v1

## 1. Purpose

This document defines the canonical Model Router for Tele•GPT.

The Model Router selects the most appropriate model for each task step using policy, quality, latency, and cost constraints.

---

## 2. Core Rule

Canonical rule:

No single-model architecture is allowed for core Tele•GPT execution.

Model selection must be dynamic, policy-scoped, and traceable.

---

## 3. Routing Inputs

Router decisions may use:
- task_type
- risk_level
- required_capabilities
- latency_budget_ms
- cost_budget
- privacy_tier
- context_window_need
- language requirements

---

## 4. Canonical Model Roles

Supported role classes:
- code_model
- reasoning_model
- search_model
- creative_model
- cheap_model
- fallback_model

Canonical rule:

Roles define behavior contracts, not vendor lock-in.

---

## 5. Decision Pipeline

The router must evaluate in order:
1. policy allowlist / denylist
2. privacy and residency requirements
3. capability fitness
4. quality tier target
5. latency and cost budgets
6. fallback availability
7. final route decision

Output fields:
- route.model_id
- route.role
- route.reason
- route.trace_id

---

## 6. Fallback Policy

If primary model is unavailable:
- retry same model by policy
- switch to approved fallback_model
- degrade gracefully when needed
- never bypass policy to recover availability

---

## 7. Audit Requirements

Every routing decision must emit:
- trace_id
- task_id
- candidate_set
- selected_model
- rejection_reasons
- cost_estimate
- timestamp

Canonical rule:

Untraced routing is non-canonical routing.

---

## 8. Conformance

A runtime conforms only if it supports:
- multi-model routing
- policy-aware selection
- explicit fallback
- trace logging
- budget-aware decisions

---

## 9. Final Canon Statement

Tele•GPT model selection must be dynamic, governed, and auditable.
The Model Router is mandatory for safe, scalable intelligence execution.
