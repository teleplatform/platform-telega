artifact_id: canon_agent_core_index_v1
status: FIXED
owner: Tele•Ga / Tele•GPT Core
scope: Canonical Index of Agent Core Documents
created_at: 2026-03-08
classification: Core Canon Index

# AGENT CORE CANON INDEX v1

## 1. Purpose

This document is the canonical index for the core Tele•GPT / Tele•Ga agent architecture.

Its purpose is to bind the foundational canons into a single entrypoint for:
- architecture review
- implementation planning
- governance
- onboarding
- future expansion

This index does not replace the detailed canons.
It defines how they relate to each other.

---

## 2. Included Canon Documents

The Tele•GPT core currently includes:

1. `CONTROLLED_AGENT_CAPABILITY_CANON_v1.md`
2. `AGENT_PERMISSION_SYSTEM_CANON_v1.md`
3. `PACK_AGENT_RUNTIME_ARCHITECTURE_v1.md`
4. `SKILL_ENGINE_CANON_v1.md`
5. `TOOL_GATEWAY_CANON_v1.md`
6. `TELE_GPT_CORE_STACK_v1.md`
7. `MODEL_ROUTER_CANON_v1.md`
8. `MEMORY_SYSTEM_CANON_v1.md`
9. `WORKSPACE_ENGINE_CANON_v1.md`
10. `EVIDENCE_BUNDLE_CANON_v1.md`
11. `MULTI_AGENT_ORCHESTRATION_CANON_v1.md`
12. `AI_MUTATION_SAFETY_CANON_v1.md`
13. `AGENT_COMMERCE_GATEWAY_CANON_v1.md`
14. `TELEGRAM_SERVERLESS_EDGE_CANON_v1.md`

These documents define the active canonical spine of Tele•GPT core.

---

## 3. Canon Roles

### 3.1 CONTROLLED_AGENT_CAPABILITY_CANON_v1.md

Role:
Defines controlled autonomy philosophy.

Covers:
- deny-by-default mindset
- no unrestricted access
- policy-governed execution
- traceable and reversible behavior

---

### 3.2 AGENT_PERMISSION_SYSTEM_CANON_v1.md

Role:
Defines enforceable access control.

Covers:
- roles and capability grants
- scope and environment boundaries
- escalation flows
- revocation and audit

---

### 3.3 PACK_AGENT_RUNTIME_ARCHITECTURE_v1.md

Role:
Defines the overall architecture of the agent runtime.

Covers:
- layer model
- orchestrator
- runtime
- workspace
- tools
- memory
- evidence
- multi-agent structure
- model router

This is the top-level execution architecture canon.

---

### 3.4 SKILL_ENGINE_CANON_v1.md

Role:
Defines how skills are structured, versioned, validated, stored, and executed.

Covers:
- skill manifest
- input schema
- output contract
- execution plan
- validators
- registry
- lifecycle
- evidence bundle

This is the canonical reusable execution layer.

---

### 3.5 TOOL_GATEWAY_CANON_v1.md

Role:
Defines controlled external integrations.

Covers:
- tool mediation through gateway
- adapter contracts
- connector boundaries
- external system safety controls

---

### 3.6 TELE_GPT_CORE_STACK_v1.md

Role:
Defines end-to-end core stack order and system formula.

---

### 3.7 MODEL_ROUTER_CANON_v1.md

Role:
Defines multi-model routing, cost/latency constraints, and fallback behavior.

---

### 3.8 MEMORY_SYSTEM_CANON_v1.md

Role:
Defines scoped memory types, retention, retrieval, and memory audit.

---

### 3.9 WORKSPACE_ENGINE_CANON_v1.md

Role:
Defines workspace isolation, lifecycle, and filesystem boundaries.

---

### 3.10 EVIDENCE_BUNDLE_CANON_v1.md

Role:
Defines mandatory evidence structure, integrity, and trace retrieval.

---

### 3.11 MULTI_AGENT_ORCHESTRATION_CANON_v1.md

Role:
Defines role-bound decomposition, handoff contracts, and verifier checkpoints.

---

### 3.12 AI_MUTATION_SAFETY_CANON_v1.md

Role:
Defines the mandatory safety contract for AI-generated changes to live commerce state.

Covers:
- draft-by-default proposals
- deterministic before/after preview
- risk classification and least-privilege authorization
- bounded, idempotent execution
- audit receipts, rollback, and compensating actions
- fail-closed controls for financial and other sensitive mutations

This is the canonical owner-control boundary for Merchant Copilot, AI Commerce OS, Tele•GPT tools, external MCP clients, services, CRM, and Marketbase operations.

---

### 3.13 AGENT_COMMERCE_GATEWAY_CANON_v1.md

Role:
Defines permissioned access for AI agents that discover, propose, and execute commerce operations.

Covers:
- declared agent identity
- merchant opt-in, scope grants, revocation, and kill switches
- typed checkout proposals and buyer confirmation
- bounded one-time payment authority
- adapter-first access and browser-fallback denial rules
- canonical order execution, signed receipts, and Uzbekistan-first providers

This is the commerce boundary for Tele•Fishka, external agents, Marketbase, storefronts, Commerce/Orders Core, and Payment Authority.

---

### 3.14 TELEGRAM_SERVERLESS_EDGE_CANON_v1.md

Role:
Defines Telegram Serverless as a channel-specific execution edge while preserving Tele•Ga Core authority and multi-channel portability.

Covers:
- Telegram handler and Mini App edge responsibilities
- SQLite edge-state boundaries
- capability forwarding into Tele•Ga Core
- heavy AI/media exclusions
- OpenCode/tgcloud deployment discipline
- migration and portability rules

---

## 4. Relationship Between Documents

Canonical dependency direction:

Controlled Capability  
→ Permission System  
→ AI Mutation Safety  
→ Runtime Architecture  
→ Workspace Engine  
→ Skill Engine  
→ Tool Gateway  
→ Agent Commerce Gateway (commerce operations)  
→ Model Router  
→ Memory System  
→ Evidence Bundle  
→ Multi-Agent Orchestration  
→ Telegram Serverless Edge (channel adapter)  
→ Tele•GPT Core Stack

Operational reading order for implementation teams:

1. `CONTROLLED_AGENT_CAPABILITY_CANON_v1.md`
2. `AGENT_PERMISSION_SYSTEM_CANON_v1.md`
3. `AI_MUTATION_SAFETY_CANON_v1.md`
4. `PACK_AGENT_RUNTIME_ARCHITECTURE_v1.md`
5. `WORKSPACE_ENGINE_CANON_v1.md`
6. `SKILL_ENGINE_CANON_v1.md`
7. `TOOL_GATEWAY_CANON_v1.md`
8. `AGENT_COMMERCE_GATEWAY_CANON_v1.md`
9. `MODEL_ROUTER_CANON_v1.md`
10. `MEMORY_SYSTEM_CANON_v1.md`
11. `EVIDENCE_BUNDLE_CANON_v1.md`
12. `MULTI_AGENT_ORCHESTRATION_CANON_v1.md`
13. `TELEGRAM_SERVERLESS_EDGE_CANON_v1.md`
14. `TELE_GPT_CORE_STACK_v1.md`

---

## 5. Canonical Formula

The current Tele•GPT agent core is defined by:

Intent  
→ Policy  
→ Permission  
→ Proposal  
→ Preview  
→ Authorization  
→ Runtime  
→ Workspace  
→ Skill  
→ Tool / Agent Commerce Gateway  
→ Bounded Execution  
→ Memory  
→ Evidence  
→ Audit / Recovery  
→ Result

This formula must be interpreted using all listed core canons.

---

## 6. What This Index Means Strategically

With these documents fixed, Tele•GPT core is no longer a loose concept.

It now has a canonical spine covering:
- execution architecture
- capability control
- permission enforcement
- owner-controlled AI mutation safety
- permissioned agent-commerce execution
- reusable skill logic
- model routing
- workspace isolation
- memory and evidence governance
- multi-agent coordination

This index marks the point where Tele•GPT becomes:
not just an assistant concept,
but a governed agent platform design.

---

## 7. What Is Not Yet Covered

The following adjacent areas remain candidates for dedicated canons:

- Automation Engine Canon
- Provider Router Canon (if split from Model Router)
- Media Factory Canon
- Interface Contract Canon

---

## 8. Usage Rule

Whenever a new core agent document is created, it must be evaluated for inclusion into this index.

If the document changes the structure of the Tele•GPT agent spine, this index must be updated.

Canonical rule:

No core canon should exist in isolation without index linkage.

---

## 9. Final Canon Statement

The Tele•GPT core agent system is founded on a governed canon spine across:

- capability philosophy
- permissions
- AI mutation safety
- agent-commerce gateway
- runtime
- workspace
- skills
- tools
- model routing
- memory
- evidence
- multi-agent coordination
- stack integration

This index is the official entrypoint into that core architecture.

It is mandatory as the first reference document for all future Tele•GPT core development.
