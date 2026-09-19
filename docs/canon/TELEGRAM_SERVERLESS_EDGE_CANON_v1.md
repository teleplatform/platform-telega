artifact_id: canon_telegram_serverless_edge_v1
status: FIXED
owner: Tele•Ga / Tele•GPT Core
scope: Telegram Channel Edge Runtime
created_at: 2026-09-19
classification: Interface / Channel Architecture Canon
source_status: Telegram Serverless Early Access

# TELEGRAM SERVERLESS EDGE CANON v1

## 1. Canonical Decision

Telegram Serverless is adopted as an optional Telegram-native edge/runtime adapter for Tele•Ga and Tele•GPT.

It is NOT a system-of-record, AI authority, provider authority, business-domain authority, or replacement for Tele•Ga Core.

Canonical boundary:

Telegram
→ Telegram Serverless Edge
→ Tele•Ga Capability Gateway / Core
→ governed runtime, providers, workers, storage
→ Telegram Serverless Edge
→ Telegram

The dependency direction must preserve channel independence so Telegram can be replaced or supplemented by Web, Tele•Ga Messenger, API, or other channel adapters without rewriting Tele•Ga Core.

---

## 2. Responsibilities

Telegram Serverless Edge MAY own:
- Telegram update ingestion
- message/callback/inline handlers
- Telegram Bot API operations
- Mini App edge/backend glue
- Telegram identity/context forwarding
- lightweight session and callback state
- Telegram-specific cache/rate-limit state
- notification delivery
- normalization and forwarding of capability requests to Tele•Ga Core

It MUST NOT own:
- model/provider selection
- Provider Router authority
- Tele•Forge execution authority
- merchant/catalog authority
- entitlement authority
- canonical identity authority
- permanent Tele•GPT memory
- canonical knowledge storage
- heavy media processing
- local model runtime
- business-domain source of truth

---

## 3. Storage Boundary

Telegram Serverless persistent SQLite is edge-local state only.

Allowed examples:
- Telegram user mapping
- session state
- callback state
- temporary jobs
- Telegram-specific preferences
- lightweight cache
- rate-limit bookkeeping

Forbidden as canonical authority:
- merchant/product databases
- Product Catalog authority
- Provider Registry
- Tele•Forge datasets
- entitlement registry
- canonical identity
- long-term Tele•GPT memory
- agent knowledge base

Canonical data must remain portable outside Telegram.

---

## 4. AI and Media Boundary

Telegram Serverless does not execute heavy AI/media workloads.

GigaAM, Whisper, FFmpeg, Ollama, Qwen, Tele•Forge workers and equivalent workloads remain behind Tele•Ga capabilities/workers.

Example:

Telegram update
→ Serverless handler
→ normalized capability request
→ Tele•Ga Capability Gateway
→ Dispatcher / Provider Router / worker
→ result
→ Serverless handler
→ Telegram

Concrete model identity remains an internal routing concern and is not exposed as product authority at the Telegram edge.

---

## 5. Transcript / Media Agent Pattern

For transcript and media agents, the edge only accepts and normalizes the source.

Canonical downstream policy remains:

source
→ available native transcript/captions?
→ yes: transcript-first
→ no: media/audio extraction
→ STT capability
→ downstream summary/analysis as requested

The Telegram edge must not duplicate transcript/STT authority.

---

## 6. Runtime Constraints

The initial Telegram Serverless environment is treated as a JavaScript/V8-specific execution environment with Telegram SDK constraints, not as general Node.js/Python hosting.

Therefore existing Python/aiogram services and heavy workers are not migrated merely to use Serverless.

Any future runtime expansion must be evaluated before changing this boundary.

---

## 7. Development and Deployment

OpenCode-compatible agentic development is permitted for this edge.

Expected workflow:

OpenCode
→ inspect AGENTS.md / Telegram SDK docs
→ edit handler/schema
→ tgcloud diff
→ tgcloud run
→ tests/review
→ tgcloud push
→ explicit migration gate when schema changes

Code deployment and database migration remain separate gates.

No automatic migration is implied by code deployment.

---

## 8. Multi-Channel Portability

Canonical target:

Telegram → Telegram Edge ─┐
Web → Web Edge ───────────┼→ Tele•Ga Core
Tele•Ga Messenger → Native Edge ─┘

Channel adapters translate transport-specific events into stable Tele•Ga capability contracts.

No Telegram-specific type or lifecycle rule may become a required dependency of the core capability/runtime layers.

---

## 9. Adoption Policy

Status is EARLY ACCESS at the upstream platform level.

Therefore adoption proceeds as:
1. discovery
2. isolated pilot
3. evidence/limits review
4. production decision

No bulk migration of existing bots is authorized by this canon.

Preferred pilot class:
- small Telegram-specific agent
- callback/notification utility
- Mini App edge backend
- transcript/media ingress adapter

---

## 10. Canonical Rule

Telegram Serverless is an execution edge, not the platform.

Tele•Ga Core remains authoritative.

If Telegram disappears, changes limits, changes pricing, or is replaced, core capabilities, provider routing, memory, business data, Tele•Forge and long-running workers must remain operational behind another channel adapter.
