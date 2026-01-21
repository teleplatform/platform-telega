Tele•Ga Agent Patterns v1.0
Canonical Standard for building autonomous / semi-autonomous agents in Tele•Ga ecosystem.
Source inspiration: Microsoft ai-agents-for-beginners (11 lessons).
Tele•Ga law: Agent = Actions, not text.

0) Purpose (what this document is)
This document defines the non-negotiable rules and reference patterns for agents inside Tele•Ga:

- Tele•GPT (Orchestrator)
- Forge IDE/CLI (Executor runtime)
- T-800 (Core + DevOps guardian)
- Proxy Core (Policy + firewall + traffic control)
- Spyglass (Context/RAG + verification)
- Quoro (Planner + patcher)

Goal: agents behave consistently, safely, and produce verifiable results via contracts.

1) Definition: what is an “agent” in Tele•Ga
An agent is a system that:

- receives a goal (Goal)
- builds a plan (Plan)
- executes steps via tools (Actions)
- produces a verifiable result (Report + Artifacts)
- logs everything (Trace/Audit)

Agent ≠ chatbot
A chatbot “talks”.
A Tele•Ga agent delivers outcomes and proves them.

2) When to use an agent (and when NOT to)
Use an agent when:

- task requires multi-step execution
- tools are needed (DB, code, files, network, UI generation)
- result must be reproducible
- there is a need for monitoring (progress/heartbeat)

Do NOT use an agent when:

- a single deterministic function call is enough
- the user only needs an explanation or short answer
- actions create unnecessary risk/cost

3) Tele•Ga canonical architecture: who does what
3.1 Tele•GPT = Orchestrator

- understands user intent
- builds tasks and sends them to Forge runtime
- chooses models/providers by policy (cheap/smart/coding)
- never fakes completion: only reports what is proven

Output: Tele•Core Contract
BuildTask → BuildResult

3.2 Forge IDE/CLI = Executor Runtime

- runs skills (scripts)
- performs retries
- streams progress + heartbeat
- generates artifacts
- validates artifacts by code

Output: verified artifacts + logs + status (done/partial/blocked)

3.3 T-800 = Core Guardian & DevOps

- “safe by default”
- audits actions
- enforces PR-first behavior (no unsafe pushes)
- monitors CI/CD and system health

Output: DevOps protocols + secure execution guarantees

3.4 Proxy Core = Nervous System + Firewall

- rate limit / anti-storm protection
- policy gating
- stable routing
- heartbeat/health enforcement

Output: secure channels + controlled execution

3.5 Spyglass = Context / RAG

- search → collect → summarize → verify
- source attribution where possible
- decides when to act vs ask

Output: context package → Quoro planner

3.6 Quoro = Planner / Patcher

- transforms context into actionable plans
- emits minimal, safe patches
- prefers small diffs + validation

Output: build-ready plan + patch proposals

4) Tele•Core Contract (the law of results)
All agent execution must be represented as:
BuildTask (input)

- immutable task_id
- kind (skill/module)
- payload (structured input)
- meta (creator/public/core, limits, tracing)
- created_at

BuildResult (output)

- status: done | partial | blocked
- artifacts[]: what was generated
- log_tail: short useful trace
- errors[]: structured error list
- updated_at

Hard law:
✅ done only if validators pass
❌ “done by words” is forbidden

5) The 11 Tele•Ga Agent Patterns (v1.0)
These are the canonical patterns we reuse across all modules.
Pattern 1 — Goal → Plan → Execute → Verify → Report

- Always show execution structure
- Never skip verification

Why: prevents “confident nonsense” and forces proof.

Pattern 2 — Tools over text
Agent must prefer:

- DB/API calls
- file generation
- validators
- structured outputs

Why: actions are measurable, text is not.

Pattern 3 — Minimal actions first (smallest safe step)

- do the smallest step that reduces uncertainty
- avoid huge monolithic execution

Why: fewer failures, faster recovery.

Pattern 4 — Contract-first design

- define schema and statuses before code
- scripts follow the contract, not the opposite

Why: stable platform evolution.

Pattern 5 — Policy Router (cheap/smart/coding)

- cheap model for simple tasks
- smart model for complex reasoning
- coding model for patches

Why: budget control + speed.

Pattern 6 — Fallback chain (never hard-fail silently)
If provider/tool fails:

- fallback to next provider/model
- record failure reason in trace

Why: resilience.

Pattern 7 — Guardrails by mode (Public vs Creator vs Core)

- Public: restricted actions, fixed presets
- Creator: extended capabilities, localhost-only custom endpoints
- Core: infra-only protected actions

Why: safety is enforced by “what can be done”, not by “what can be said”.

Pattern 8 — Heartbeat & staleness control
Any long job must:

- send heartbeat
- track progress 0..100
- be detectable as stale

Why: prevents zombie tasks and UI deadlocks.

Pattern 9 — Observability always on
At minimum we log:

- provider + model
- latency_ms
- tokens_in/out (if available)
- ok flag + error_code/message

Why: debugging without logs is superstition.

Pattern 10 — Memory tiers (L1/L2/L3)

- L1: request-local context (current task)
- L2: session memory (short-lived)
- L3: canonical knowledge base (docs, frozen contracts)

Rules:

- L3 is the source of truth
- memory must be bounded
- never leak secrets

Pattern 11 — Human takeover points
Agents must define where human approval is mandatory:

- payments
- destructive actions
- deployments
- security-sensitive operations

Why: autonomy without checkpoints becomes chaos.

6) Standard templates (copy-paste ready)
6.1 Agent Plan Template
Goal:
- ...

Constraints:
- mode: public|creator|core
- budget/time limits: ...
- allowed tools: ...

Plan:
1) ...
2) ...
3) ...

Verification:
- validator A
- validator B

Exit status:
- done if all checks pass
- partial if some artifacts exist
- blocked if prerequisites missing

6.2 Tool Call Template (conceptual)
Tool:
- name: <tool_name>

Input:
- structured fields...

Expected output:
- artifacts / data...

Failure handling:
- retry N times
- fallback tool/provider
- log error_code

6.3 Report Template (BuildResult summary)
Status: done|partial|blocked

Artifacts:
- path + description

Key logs:
- last N lines

Notes:
- what was verified
- what remains

6.4 Risk Flags Template
RISK FLAGS:
- high_cost: true/false
- destructive_action: true/false
- external_network: true/false
- privacy_sensitive: true/false

Required approval:
- yes/no

7) Non-negotiable rules (Tele•Ga “Agent Constitution”)

- No fake completion (only validators can allow done)
- Actions over text
- Contract-first
- PR-first for code changes (push is restricted)
- Creator-only custom endpoints (localhost allowlist)
- Trace everything (provider/model/latency/errors)
- Fallback must be explicit
- Memory is bounded + scoped
- Human takeover is mandatory for risky operations

8) Canonical mapping (quick reference)
Tele•GPT → Orchestrator + router
Forge → Execution factory + validators
T-800 → DevOps + safety enforcement
Proxy Core → policy + anti-storm + heartbeat
Spyglass → context + verification
Quoro → planning + patching

9) Versioning & freeze

Version: v1.0

Changes must be documented in CHANGELOG.md

Contract changes require schema bump (v1 → v1.1 etc.)

10) Final law
We did not “watch a course”.
We forged a platform standard.
✅ same behavior across Tele•GPT / Forge / T-800 / Proxy Core / Spyglass
✅ same execution truth: Tele•Core Contract
✅ same safety principle: actions are gated, results are validated

END OF DOCUMENT
