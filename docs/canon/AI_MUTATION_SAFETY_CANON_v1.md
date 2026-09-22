artifact_id: canon_ai_mutation_safety_v1
status: FIXED
owner: Tele•Ga Product & Architecture
scope: Governed AI mutations across commerce, services, CRM, and Marketbase
accepted_at: 2026-09-14
classification: Platform Safety Canon

# Tele•Ga Canonical Decision — Agentic Commerce Safety Baseline

**Status:** CANONICAL · ACCEPTED · ACTIVE REQUIREMENT  
**Decision ID:** `TG-CANON-AI-MUTATION-001`  
**Accepted:** 2026-09-14  
**Evidence date:** 2026-09-13  
**Owner:** Tele•Ga Product & Architecture  
**Trigger:** PuzzleBot launch of Puzzlo AI, official MCP server, and announced tariff transition

## 1. Canonical decision

Tele•Ga will support natural-language, agent-driven creation and operation of stores, services, CRM workflows, Telegram Mini Apps, and Marketbase listings. However, AI autonomy must never bypass owner control over commercially or operationally sensitive state.

The canonical Tele•Ga pattern is:

> **Draft by default → deterministic preview → explicit authorization → bounded execution → audit trail → reversible result.**

This safety contract is a platform requirement, not an optional interface behavior. It applies equally to Merchant Copilot, AI Commerce OS, Tele•GPT-mediated workflows, seller tools, services, CRM, and Marketbase operations.

## 2. Confirmed competitor signal

On 13 September 2026, PuzzleBot announced a material shift from visual bot construction toward an agentic Telegram-commerce platform:

- **Puzzlo AI** can create and edit commands, conditions, formulas, variables, scenarios, and Telegram Mini Apps from natural-language instructions.
- PuzzleBot launched an official remote **MCP server** compatible with Codex, Claude Code, Cursor, VS Code, and other MCP clients.
- The MCP documentation exposes **32 tools** covering bot analysis and validation, structure and change inspection, store products and categories, prices, inventory, payments, delivery, scenarios, knowledge sources, and related operational objects.
- Most AI-generated configuration changes are stored as drafts until manual publication.
- Store-product changes and automated-posting scenarios may be applied immediately, creating a meaningful control and safety gap.
- PuzzleBot also redesigned its dashboard, support, and knowledge base and began moving product surfaces to the `.bot` domain.

Primary evidence:

- [Official PuzzleBot release, 13 September 2026](https://t.me/wearepuzzlebot/1329)
- [Official PuzzleBot MCP documentation](https://help.puzzle.bot/articles/mcp)

## 3. Pricing and packaging signal

PuzzleBot simultaneously introduced a three-day promotion for annual individual plans:

| Plan | Previous annual price | Promotional price | Change |
| --- | ---: | ---: | ---: |
| Creative | 11,880 ₽ | 8,270 ₽ | −30% |
| Extended | 20,280 ₽ | 14,170 ₽ | −30% |
| Professional | 35,880 ₽ | 25,070 ₽ | −30% |

Legal entities receive a 10% discount. PuzzleBot also announced a forthcoming tariff grid but had not published its composition, limits, or final prices at the evidence date.

Primary evidence: [Official PuzzleBot pricing announcement, 13 September 2026](https://t.me/wearepuzzlebot/1330)

## 4. Strategic assessment

**Impact on Tele•Ga:** HIGH  
**Required response:** IMPROVE

PuzzleBot now overlaps directly with Tele•Ga’s Merchant Copilot and AI Commerce OS direction: an AI agent can assemble and modify trading Mini Apps and operational workflows through a standard tool protocol.

The competitive lesson is not merely to add an MCP endpoint or conversational builder. Tele•Ga must make agentic commerce safer, more locally complete, and more coherent across products, services, CRM, and Marketbase.

## 5. Mandatory AI Mutation Safety Contract

### 5.1 Draft-by-default

Every AI-generated mutation must first create a proposal or draft. No tool, model, client, or integration may silently promote a draft into live business state.

### 5.2 Risk classification

Each proposed action must be classified before execution:

| Risk | Examples | Minimum control |
| --- | --- | --- |
| Low | description rewrite, translation, visual copy | preview; reversible publish |
| Medium | category mapping, workflow rule, customer tag, schedule template | preview + owner or delegated-role confirmation |
| High | price, stock, payment, refund, discount, broadcast, service availability, booking capacity | explicit confirmation + permission check + audit event |
| Critical | bulk price update, mass message, deletion, payout, account/role change, irreversible integration action | two-step confirmation, bounded scope, fail-closed execution, recovery plan |

### 5.3 Preview contract

Before confirmation, Tele•Ga must show:

- the exact objects and fields that will change;
- before/after values;
- scope and estimated affected records;
- customer, financial, inventory, booking, and communication consequences;
- identity of the initiating user, agent, model-independent tool, and delegated role;
- whether the action is fully reversible and the rollback boundary.

### 5.4 Authorization

- Owner-only actions must remain owner-only even when initiated through Tele•GPT or MCP.
- Delegated roles receive least-privilege, object-scoped permissions and explicit limits.
- A model recommendation is never authorization.
- Expired, ambiguous, or changed proposals must be reconfirmed.
- High-risk and critical actions fail closed if identity, permission, current state, or confirmation cannot be verified.

### 5.5 Execution guarantees

- Use idempotency keys for every mutation.
- Revalidate assumptions immediately before apply.
- Enforce object-count, monetary, time-window, and rate limits.
- Separate preview and execution credentials where practical.
- Prevent partial success from being reported as full success.
- Return a machine-readable execution receipt.

### 5.6 Audit and recovery

Every action must record initiator, approver, timestamp, source interface, proposal, diff, policy decision, execution result, and rollback reference. Versioning and rollback are required for all reversible configuration and content changes. Financial and externally committed actions require compensating-action guidance when true rollback is impossible.

## 6. Required Tele•Ga capabilities

1. Natural-language commands in Uzbek and Russian, with English as an additional operating language.
2. A unified tool contract for products, variants, stock, customers, orders, payments, services, bookings, content, and Marketbase listings.
3. Safe adapters for Click, Payme, Uzum, Uzcard, and Humo without exposing provider-specific complexity to agents.
4. Versioned proposals, visual diffs, approvals, audit history, and rollback in the seller workspace.
5. Ready-made governed workflows for retail stores, service providers, and Marketbase sellers.
6. A model-neutral agent interface: the end user interacts with Tele•Ga capabilities, not a visible dependency on a specific model vendor.
7. Clear AI quotas and usage counters, with separate accounting for content generation, translation, CRM summaries, customer replies, and operational actions.

## 7. Explicit product boundaries

Tele•Ga must not:

- reproduce PuzzleBot’s immediate application of sensitive product or autoposting changes;
- equate tool availability with permission to act;
- allow external MCP clients to bypass Tele•Ga identity, role, policy, or audit layers;
- make live financial, inventory, booking, or mass-communication changes from an unreviewed prompt;
- expose the underlying model choice as the product experience or security boundary.

## 8. Roadmap implications

### P0 — Architecture invariant

- Establish the AI Mutation Safety Contract as a shared platform policy.
- Require proposal, preview, authorization, receipt, and audit primitives in every commerce mutation API.
- Place identity and policy enforcement below all assistants, MCP clients, and UI surfaces.

### P1 — Merchant Copilot parity and differentiation

- Natural-language creation/editing for seller workflows and Telegram Mini Apps.
- RU/UZ commands and bilingual content generation.
- Governed product, inventory, service, booking, and CRM operations.
- Visual change sets and one-click rollback for reversible actions.

### P2 — Ecosystem surface

- Publish a bounded, permission-aware Tele•Ga MCP/tool interface.
- Add industry workflow packs and testable policy templates.
- Support delegated staff roles with per-action approval thresholds.

## 9. Competitive watch follow-up

Continue monitoring PuzzleBot specifically for:

- the final composition and effective date of the new tariff grid;
- AI and MCP quotas by plan;
- whether immediate store/autoposting mutations gain approval or rollback controls;
- payments, delivery, CRM, booking, or Uzbekistan-specific integrations;
- commercial terms for remote MCP and third-party agent access.

Any confirmed change in these items must be treated as a new competitive event and evaluated against this decision.

## 10. Acceptance criteria

This decision is implemented only when:

- no sensitive mutation path can bypass preview and required confirmation;
- all execution paths share the same identity, policy, idempotency, audit, and recovery controls;
- RU/UZ workflows cover products and services, not content generation alone;
- local payment adapters participate in the same governed action contract;
- external tool protocols cannot obtain broader authority than the initiating Tele•Ga principal.

---

**Canonical summary:** match the speed and flexibility of agentic Telegram commerce; exceed competitors through owner-controlled execution, Uzbekistan-first integrations, cross-domain coverage, and auditable reversibility.
