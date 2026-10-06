# TELEGPT AI Radar Authority v1

Status: RESEARCH AUTHORITY
Scope: external AI/model/agent/runtime signals relevant to TeleGPT
Authority boundary: research intake and prioritization only
Implementation authority: NONE
Canonical architecture authority: NONE
Baseline repository: teleplatform/platform-telega
Created: 2026-10-06

## 1. Purpose

This document is the research intake authority for external AI signals that may matter to TeleGPT.

A radar entry does not authorize implementation, adoption, dependency installation, architecture changes, or canonical claims about TeleGPT.

Required progression:

external signal -> source verification -> relevance assessment -> TeleGPT E2 diagnosis -> D0 candidate -> explicit implementation/canon gate

No external design is assumed to exist in TeleGPT until E2 evidence establishes it.

## 2. Provenance classes

- P0: first-party product documentation, vendor announcement, or upstream source repository.
- P1: upstream technical report / maintained project documentation.
- S: secondary report, digest, social post, video, or third-party summary.
- D0: TeleGPT design hypothesis derived from evidence; never promoted automatically from P0/P1/S.

Secondary material may discover a signal but does not establish internal architecture or implementation truth.

## 3. Radar states

- SIGNAL: discovered; verification incomplete.
- VERIFIED: identity/core claim confirmed from P0/P1.
- RESEARCH_CANDIDATE: verified and materially relevant; requires focused architecture mining.
- POC_CANDIDATE: sufficiently scoped for a controlled proof-of-concept after E2 diagnosis.
- WATCH: useful to monitor; no current engineering action.
- REJECTED: investigated and not useful enough to continue.

None of these states grants implementation authority.

## 4. Intake — 2026-10-06

### R-001 — NVIDIA OpenShell

State: RESEARCH_CANDIDATE
Priority: HIGH
Provenance: P0
Source: NVIDIA OpenShell official product/developer documentation
Verified core signal: OpenShell provides an external secure runtime for AI agents with sandboxing, deny-by-default policy, credential/network/filesystem controls, and auditable enforcement outside the agent process.
TeleGPT relevance: compare its enforcement boundary with TeleGPT Policy/AuthZ, Execution Adapter, Evidence, credential handling, network/filesystem/tool capabilities, and Privacy Shield direction.
Required next evidence: E2 map of the actual TeleGPT enforcement path and bypass boundaries.
Forbidden inference: do not claim TeleGPT already implements an OpenShell-equivalent boundary.
Implementation: NOT AUTHORIZED.

### R-002 — EverMind Raven

State: RESEARCH_CANDIDATE
Priority: HIGH
Provenance: P0/P1
Source: EverMind-AI/Raven upstream repository and technical-report release
Verified core signal: Raven describes a "Harness of Harnesses" architecture that composes specialized model-harness pairs, persistent memory, reusable skills, orchestration, and self-evolution/evaluation mechanisms.
TeleGPT relevance: architecture mining against ALITA / PANTHEON / DAIMON, Sigma Forge, memory, Evidence/QA, and reusable skill evolution.
Required next evidence: source-level decomposition of Host Agent, harness composition, Skill Forge/Evolver, evaluation gates, and persistence; then E2 comparison.
Forbidden inference: upstream benchmark claims are not TeleGPT capability evidence and do not justify adoption.
Implementation: NOT AUTHORIZED.

### R-003 — DeepSeek Harness

State: RESEARCH_CANDIDATE
Priority: HIGH
Provenance: P0
Source: deepseek-ai/deepseek-harness upstream repository
Verified core signal: DeepSeek Harness is an open-source agent harness built around an "everything-is-a-plugin" architecture and is currently described upstream as developer preview with compatibility-breaking changes expected.
TeleGPT relevance: compare plugin lifecycle, discovery, composition, state, dependencies, permissions, scheduling, UI exposure, and runtime boundaries with TeleGPT registries/tools/agents/connectors.
Required next evidence: focused source-level plugin contract and lifecycle map, followed by E2 comparison.
Constraint: developer-preview status raises adoption risk.
Implementation: NOT AUTHORIZED.

### R-004 — SGLang structured decisions

State: POC_CANDIDATE
Priority: HIGH
Provenance: SIGNAL_FROM_SECONDARY; P0 VERIFICATION REQUIRED BEFORE POC
Verified core signal: pending exact upstream endpoint/contract verification in the radar workflow.
TeleGPT relevance: structured low-entropy decisions may fit Router, Policy, QA, risk gates, agent selection, triage, approval and Next Action decisions better than free-form generation.
Required next evidence: verify upstream API semantics and supported models; then inspect TeleGPT decision points and define a bounded local POC.
Implementation: NOT AUTHORIZED.

### R-005 — OpenAI Dots

State: WATCH
Priority: HIGH
Provenance: existing dedicated TeleGPT Dots research authority; do not duplicate evidence here
Radar role: cross-reference only.
TeleGPT relevance: persistent/proactive agent architecture and long-running personal-agent behavior.
Required next evidence: continue under the existing Dots evidence scheme (E0/E1/E2/F1/S/D0).
Constraint: this radar must not overwrite or weaken that provenance model.
Implementation: NOT AUTHORIZED.

### R-006 — GPT-6.1 Sol

State: VERIFIED
Priority: MEDIUM-HIGH
Provenance: P0
Source: OpenAI official GPT-6.1 Sol announcement
Verified core signal: official API pricing is $2/M input, $0.10/M cached input, and $10/M output; OpenAI positions Sol as near-Astra capability at one-fifth of Astra standard input/output token prices.
TeleGPT relevance: Model Router escalation policy and PXPIPE economics.
Required next evidence: recompute routing/compression economics by cached vs uncached input, output cost, compression overhead, successful-task cost, and cache-prefix reuse.
Forbidden inference: price alone does not establish that Sol should replace any current route.
Implementation: NOT AUTHORIZED.

## 5. Deferred/no-action signals from the source digest

Other items in the 2026-09-29 through 2026-10-04 digest remain outside the active engineering queue unless independently promoted through source verification and relevance review.

This includes visual-generation/editor releases, market/business stories, robotics/macroeconomic signals, simulation anecdotes, legal/news items, and other model announcements without a current TeleGPT architecture or economics decision attached.

Absence from the active queue is not a claim that a signal is false or unimportant.

## 6. Proposed research bundle

Working identifier:

TELEGPT-EXTERNAL-AGENT-ARCHITECTURE-MINING-1

Candidate scope:
- NVIDIA OpenShell
- Raven
- DeepSeek Harness
- SGLang structured decisions

Gate:
1. verify upstream sources;
2. extract architecture without implementation;
3. establish TeleGPT E2 current state;
4. produce explicit deltas only;
5. classify each delta as D0;
6. require a separate decision before POC, implementation, dependency adoption, or canon changes.

Dots remains in its dedicated research stream.
GPT-6.1 Sol remains primarily in model-economics/router analysis.

## 7. Authority rule

This file is authoritative only for radar intake status and research prioritization.

It MUST NOT be cited as proof of:
- TeleGPT runtime behavior;
- implemented TeleGPT capabilities;
- architectural equivalence with an external system;
- approval to install or integrate an external dependency;
- canonical TeleGPT architecture.

Those claims require their own evidence and authority.
