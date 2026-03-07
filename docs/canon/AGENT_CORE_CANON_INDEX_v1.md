artifact_id: canon_agent_core_index_v1
status: FIXED
owner: Tele•Ga / Tele•GPT Core
scope: Canonical Index of Agent Core Documents
created_at: 2026-03-07
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

The agent core currently consists of the following canonical documents:

1. `PACK_AGENT_RUNTIME_ARCHITECTURE_v1.md`
2. `AGENT_PERMISSION_SYSTEM_CANON_v1.md`
3. `SKILL_ENGINE_CANON_v1.md`
4. `CONTROLLED_AGENT_CAPABILITY_CANON_v1.md`

These documents together define the minimum viable canonical spine of Tele•GPT core.

---

## 3. Canon Roles

### 3.1 PACK_AGENT_RUNTIME_ARCHITECTURE_v1.md

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

### 3.2 AGENT_PERMISSION_SYSTEM_CANON_v1.md

Role:
Defines how permissions, capability grants, scopes, roles, and escalation rules work.

Covers:
- deny-by-default
- role system
- capability system
- scope model
- escalation flow
- revocation
- audit

This is the canonical governance and access control layer.

---

### 3.3 SKILL_ENGINE_CANON_v1.md

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

### 3.4 CONTROLLED_AGENT_CAPABILITY_CANON_v1.md

Role:
Defines the foundational philosophy of Tele•GPT agents.

Covers:
- controlled capability model
- rejection of unrestricted agents
- policy-governed execution
- safe autonomy
- traceability and reversibility

This is the canonical security philosophy behind the system.

---

## 4. Relationship Between Documents

The relationship is as follows:

Controlled Capability Canon  
→ defines the philosophical foundation

Permission System Canon  
→ defines what is allowed and how access is granted

Skill Engine Canon  
→ defines reusable executable units

Agent Runtime Architecture  
→ defines how the system executes everything together

Canonical dependency direction:

Controlled Capability  
→ Permission System  
→ Skill Engine  
→ Runtime Architecture

Operational reading order for implementation teams:

1. `CONTROLLED_AGENT_CAPABILITY_CANON_v1.md`
2. `AGENT_PERMISSION_SYSTEM_CANON_v1.md`
3. `SKILL_ENGINE_CANON_v1.md`
4. `PACK_AGENT_RUNTIME_ARCHITECTURE_v1.md`

---

## 5. Canonical Formula

The current Tele•GPT agent core is defined by:

Intent  
→ Policy  
→ Permission  
→ Runtime  
→ Workspace  
→ Skill  
→ Tool  
→ Memory  
→ Evidence  
→ Result

This formula must be interpreted using the detailed rules from the four referenced canons.

---

## 6. What This Index Means Strategically

With these four documents fixed, Tele•GPT core is no longer a loose concept.

It now has a canonical spine covering:
- execution architecture
- capability control
- permission enforcement
- reusable skill logic

This index marks the point where Tele•GPT becomes:
not just an assistant concept,
but a governed agent platform design.

---

## 7. What Is Not Yet Covered

The following areas are still adjacent and should later receive dedicated canons:

- Tool Gateway Canon
- Memory System Canon
- Evidence Bundle Canon
- Workspace Engine Canon
- Multi-Agent Orchestration Canon
- Provider Router Canon
- Tele•GPT Core Stack Canon

These are not part of this index yet, but are considered logical next-layer canons.

---

## 8. Usage Rule

Whenever a new core agent document is created, it must be evaluated for inclusion into this index.

If the document changes the structure of the Tele•GPT agent spine, this index must be updated.

Canonical rule:

No core canon should exist in isolation without index linkage.

---

## 9. Final Canon Statement

The Tele•GPT core agent system is currently founded on four canonical documents:

- runtime architecture
- permission system
- skill engine
- controlled capability philosophy

This index is the official entrypoint into that core architecture.

It is mandatory as the first reference document for all future Tele•GPT core development.
