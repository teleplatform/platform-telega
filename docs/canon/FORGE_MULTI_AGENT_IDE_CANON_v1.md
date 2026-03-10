artifact_id: canon_forge_multi_agent_ide_v1
status: FIXED
owner: Tele•Ga / Sigma Forge Core
scope: Multi-Agent IDE Architecture
created_at: 2026-03-10
classification: Forge Architecture Canon

# FORGE MULTI AGENT IDE CANON v1

## 1. Purpose

This document defines the canonical architecture of Sigma Forge as a multi-agent development environment.

Traditional AI IDEs rely on a single assistant agent embedded in the editor.

Sigma Forge adopts a multi-agent orchestration model where specialized agents collaborate to perform software development tasks.

The goal is to provide structured autonomous development rather than unverified code generation.

---

## 2. Core Principle

Canonical rule:

Software development inside Sigma Forge must be executed through orchestrated agent roles rather than a single monolithic assistant.

Forge acts as an operational center coordinating multiple specialized agents.

Canonical structure:

User  
→ Task  
→ Planner Agent  
→ Developer Agent  
→ Critic Agent  
→ Verifier Agent  
→ Policy Gate  
→ Evidence Bundle  
→ Result

---

## 3. Agent Roles

### 3.1 Planner Agent

Responsibilities:

- interpret user task
- analyze project context
- break task into execution steps
- define acceptance criteria
- prepare execution plan

Planner produces a structured plan before implementation begins.

---

### 3.2 Developer Agent

Responsibilities:

- implement code changes
- generate patches
- modify project files within workspace
- generate tests when required
- prepare commit proposals

Developer focuses on implementation.

---

### 3.3 Critic Agent

Responsibilities:

- analyze developer output
- identify logical flaws
- detect architectural issues
- detect security vulnerabilities
- detect incomplete requirements

Critic provides adversarial review.

---

### 3.4 Verifier Agent

Responsibilities:

- run tests
- validate contracts and schemas
- check dependency integrity
- validate diff severity
- verify acceptance criteria

Verifier confirms whether implementation meets requirements.

---

### 3.5 Research Agent

Responsibilities:

- retrieve documentation
- search API references
- analyze external libraries
- gather context from repositories or web sources

Research Agent supports other agents with external knowledge.

---

### 3.6 Memory Agent

Responsibilities:

- retrieve relevant system memory
- maintain project context
- recall architectural decisions
- inject relevant knowledge into execution

Memory Agent ensures agents operate with full context.

---

## 4. IDE Interface Panels

Sigma Forge must expose the agent process transparently through interface panels.

Recommended canonical panels:

Plan  
Shows structured execution plan.

Patch  
Displays proposed code changes.

Critique  
Displays analysis from the Critic Agent.

Verification  
Shows test results and validation outcomes.

Evidence  
Displays traceable execution records.

Memory  
Displays retrieved context and related knowledge.

Tools  
Displays tools and skills used during execution.

---

## 5. Orchestration Flow

Canonical flow:

User Task  
↓  
Planner Agent creates execution plan  
↓  
Developer Agent implements patch  
↓  
Critic Agent reviews output  
↓  
Developer revises implementation  
↓  
Verifier Agent runs validation  
↓  
Policy Gate checks constraints  
↓  
Evidence bundle generated  
↓  
User approval or automatic promotion

---

## 6. Approval Points

Sigma Forge must include explicit approval points.

Approval may occur at:

- execution plan approval
- patch acceptance
- high-risk modification confirmation
- production deployment approval

Approval points maintain human control over autonomous actions.

---

## 7. Evidence Visibility

All agent actions must produce traceable evidence.

Evidence includes:

- plan generation
- patch generation
- critique reports
- verification results
- policy decisions
- tool usage logs

Evidence must be visible within the IDE.

---

## 8. Handoff Between Agents

Agent collaboration must follow explicit handoff rules.

Example:

Planner → Developer  
Developer → Critic  
Critic → Developer  
Developer → Verifier  
Verifier → Policy Gate

Agents must communicate through structured artifacts rather than raw conversation.

---

## 9. Skill Engine Integration

Agents may execute tasks through the Skill Engine.

Examples:

- code formatting
- static analysis
- dependency analysis
- database migration generation
- build orchestration

Skill execution must be traceable.

---

## 10. Tool Gateway Integration

All tool usage must pass through Tool Gateway.

Examples:

- filesystem access
- terminal commands
- repository operations
- API calls
- build systems

Tool Gateway enforces capability restrictions.

---

## 11. Memory System Integration

Agents must retrieve relevant context through the memory system.

Possible memory sources:

- project knowledge
- architectural decisions
- historical solutions
- entity references
- evidence archives

Memory ensures continuity across tasks.

---

## 12. Public vs Creator Modes

### Public Mode

Restrictions:

- limited agent orchestration depth
- restricted tools
- conservative policy enforcement

Public Mode prioritizes safety.

---

### Creator Mode

Capabilities:

- full multi-agent orchestration
- advanced tools
- deeper reasoning cycles
- experimental workflows

Creator Mode remains policy-governed.

---

## 13. Strategic Position

Sigma Forge is not an AI-assisted code editor.

Sigma Forge is an operational environment for autonomous development.

The IDE acts as the coordination layer for agent collaboration.

---

## 14. Conformance Requirements

A system conforms to this canon only if it supports:

- multiple agent roles
- structured orchestration
- visible execution panels
- explicit approval points
- evidence visibility
- memory integration
- skill integration
- tool gateway enforcement

---

## 15. Final Canon Statement

Software development inside Sigma Forge must be governed by structured multi-agent orchestration.

The IDE is not a chat interface.

The IDE is an operational control center for autonomous development agents.
