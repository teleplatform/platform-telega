artifact_id: canon_agent_commerce_gateway_v1
status: FIXED
owner: Tele•Ga Product & Architecture
scope: Permissioned AI-agent access to catalog, checkout, orders, and payments
accepted_at: 2026-09-22
classification: Commerce Architecture and Safety Canon

# Tele•Ga Canonical Decision — Permissioned Agent Commerce Gateway

**Status:** CANONICAL · ACCEPTED · ACTIVE REQUIREMENT  
**Decision ID:** `TG-CANON-AGENT-COMMERCE-001`  
**Accepted:** 2026-09-22  
**Evidence date:** 2026-09-21  
**Owner:** Tele•Ga Product & Architecture  
**Trigger:** Shopify/Shop Pay cooperation with Meta Muse contrasted with Amazon blocking unauthorized Muse access

## 1. Canonical decision

Tele•Ga will support AI agents that discover products, prepare carts, and complete purchases only through a permissioned, identity-aware commerce boundary.

The canonical flow is:

> **Declared agent identity → merchant consent → scoped catalog access → typed checkout proposal → buyer confirmation → bounded payment authority → canonical order execution → signed receipt and audit.**

Agent convenience never creates commercial authority. The Agent Commerce Gateway mediates every agent-originated commerce action and delegates authoritative work to existing Commerce Core, Orders Core, Identity/Capability Policy, and Payment Authority services.

No agent, including Tele•Fishka, may become an independent source of truth for catalog, price, stock, cart, order, customer, entitlement, or payment state.

## 2. Confirmed market signal

On 21 September 2026, reports described two opposite platform responses to Meta Muse:

- Shopify and Meta are preparing a structured Muse checkout path using Shopify commerce data and Shop Pay.
- Amazon blocked Muse after treating its access as unauthorized and raising concerns about agent identification, credentials, data access, platform consent, and customer experience.

Evidence:

- [The Wall Street Journal — Shopify to use Meta's Muse for agentic checkout, 21 September 2026](https://www.wsj.com/tech/shopify-to-use-metas-muse-for-agentic-checkout-d23947c0)
- [The Verge — Amazon blocks Meta's Muse AI agent, 21 September 2026](https://www.theverge.com/tech/998078/amazon-blocks-meta-muse-ai-agent-shopping)

The reusable lesson is not to choose “allow” or “block” globally. A commerce platform must distinguish sanctioned agent access from undeclared browser automation and enforce merchant, buyer, and platform policy at the transaction boundary.

## 3. Strategic response

**Impact on Tele•Ga:** HIGH  
**Required response:** IMPROVE

Tele•Ga should make Marketbase and merchant storefronts agent-ready without surrendering seller control, buyer confirmation, local payment safety, or canonical order authority.

The differentiator for Uzbekistan is a provider-neutral gateway that supports Uzbek and Russian interaction, local payment rails, Telegram-native discovery, services and bookings, and explicit permissions understandable to small merchants.

## 4. System boundary and authorities

| Component | Canonical responsibility | Explicitly forbidden authority |
| --- | --- | --- |
| Agent Commerce Gateway | Agent identity, consent lookup, scopes, proposals, policy checks, receipts | Catalog, cart, order, inventory, customer, or payment source of truth |
| Commerce Core / Gateway | Catalog reads, price and stock validation, cart/draft-order commands | Granting an agent broader identity or payment rights |
| Orders Core | Canonical order lifecycle and idempotent state transitions | Accepting unconfirmed agent instructions as buyer authorization |
| Payment Authority | Payment intent, provider adapter, capture/refund policy, payment receipt | Persistent general-purpose agent spending credentials |
| Marketbase / merchant storefront | Merchant opt-in, agent-visible assortment, terms, fulfillment promises | Bypassing platform policy or buyer confirmation |
| Tele•Fishka / external agents | User-facing planning and bounded execution client | Credential custody or independent production order/payment state |

The gateway is a policy enforcement and protocol boundary, not a replacement commerce backend.

## 5. Mandatory Agent Commerce Contract

### 5.1 Declared identity

Every request must carry a verifiable actor chain:

- buyer principal;
- merchant/store principal;
- agent principal and publisher;
- client/channel identity;
- delegated role, if any;
- trace identifier.

Agents must identify themselves to the platform and merchant. Undeclared automation fails closed.

### 5.2 Merchant consent and opt-out

Agent access is deny-by-default.

A merchant may grant, limit, suspend, or revoke access by:

- store, location, catalog, category, product, service, or booking resource;
- operation type: read, recommend, quote, create draft, reserve, submit order;
- channel or approved agent/publisher;
- time window, rate, monetary, inventory, and order-count limit;
- payment or fulfillment method;
- geography and language.

Revocation must take effect before the next state-changing operation. Platform and merchant kill switches must be available independently.

### 5.3 Scoped discovery

Agents receive only the assortment and fields allowed by merchant and platform policy. Responses must include stable identifiers, current price/currency, availability, variant/service constraints, fulfillment terms, policy version, and freshness metadata.

Search results, recommendations, and prices are informative until revalidated during checkout. Agent-visible catalog access does not imply permission to purchase.

### 5.4 Typed proposal

An agent-originated checkout must begin as a proposal, never a live order.

Minimum proposal envelope:

```yaml
proposal_id: immutable id
trace_id: end-to-end trace
buyer_principal_id: authenticated buyer
merchant_id: canonical merchant
agent_principal_id: declared agent
channel: telegram | web | api | messenger
scope_grant_id: active merchant/platform grant
items: canonical product/variant/service ids and quantities
expected_amount: amount and currency
fulfillment: delivery, pickup, or booking intent
expected_state_version: catalog/price/stock version
idempotency_key: replay protection
expires_at: short-lived deadline
```

The proposal must be deterministic enough to render a human-readable preview and a machine-verifiable execution request.

### 5.5 Buyer confirmation

Before order submission, the buyer must see and confirm:

- agent identity and channel;
- merchant and fulfillment party;
- exact items/services, variants, quantities, and booking time where applicable;
- item totals, discounts, fees, delivery, taxes, and final amount;
- payment method and provider;
- substitutions, cancellation, refund, and data-sharing terms;
- proposal expiry and any irreversible effect.

A recommendation, prior conversation, saved preference, or agent click is not buyer confirmation. Material changes after preview invalidate confirmation and require a new proposal.

### 5.6 Bounded payment authority

Agents must never receive reusable payment credentials.

Payment Authority may issue a one-time Payment Intent Capsule bounded to:

- one buyer, merchant, order/proposal, currency, and maximum amount;
- one approved payment provider and operation;
- a short expiry;
- one successful use;
- an explicit buyer authorization reference;
- replay, merchant-mismatch, amount-mismatch, and scope-mismatch checks.

Click, Payme, Uzum, Uzcard, Humo, and future providers must be implemented behind the same provider-neutral contract. Secrets remain inside Payment Authority or the provider's approved secure flow.

### 5.7 Canonical execution

After confirmation, the gateway submits typed commands to canonical domain services. Execution must:

- revalidate identity, grants, price, stock/capacity, policy version, and proposal expiry;
- use idempotency and optimistic state/version checks;
- create or mutate only canonical carts/orders/bookings;
- return partial outcomes explicitly;
- fail closed when state, permissions, identity, or payment authority is ambiguous;
- use compensating actions where external financial or fulfillment commitments cannot be rolled back.

### 5.8 Receipt, evidence, and recovery

Every attempt produces a machine-readable receipt containing:

- proposal and confirmation references;
- policy/grant decision;
- authoritative order/booking and payment identifiers;
- state versions used and final status;
- execution timestamps and adapter/provider results;
- error or denial code;
- rollback or compensating-action reference;
- evidence bundle / trace reference.

The buyer and merchant receive understandable confirmation in the active RU/UZ/EN language.

## 6. Adapter-first access and browser fallback

The preferred order is:

1. native Tele•Ga capability contract;
2. merchant-approved API/MCP/commerce adapter;
3. structured deep link or provider-hosted confirmation;
4. browser automation only as an explicitly permitted, bounded fallback.

Browser fallback must not:

- bypass authentication, access controls, bot restrictions, merchant opt-out, or platform terms;
- conceal agent identity;
- scrape or retain customer credentials;
- infer consent from mere website availability;
- execute payment without the same proposal, confirmation, and Payment Intent Capsule controls;
- continue after a deny signal, access challenge, or policy mismatch.

If sanctioned access is unavailable, the correct result is a structured denial or handoff to the user, not circumvention.

## 7. Tele•Fishka requirements

Tele•Fishka is an execution surface and agent client, not commerce authority.

It must:

- declare its agent and publisher identity on every external operation;
- use Agent Commerce Gateway contracts for Tele•Ga/Marketbase commerce;
- prefer adapters over page automation;
- show preview and request confirmation before checkout or payment;
- keep credentials in approved connector/provider sessions, never in agent memory;
- honor merchant/platform deny and opt-out immediately;
- preserve a user-visible stop control and platform kill switch;
- return receipts and denial reasons instead of claiming success from UI appearance alone.

## 8. Uzbekistan-first requirements

The first-class operating context includes:

- RU/UZ/EN buyer and merchant interactions;
- UZS prices and local fee presentation;
- Click, Payme, Uzum, Uzcard, and Humo adapters;
- Telegram/Mini App, Web, and future Tele•Ga Messenger channels;
- cash, QR, provider-hosted confirmation, and deferred/manual payment where allowed;
- products, services, appointments, and bookings;
- local delivery/pickup promises and contact-data minimization;
- seller controls simple enough for microbusinesses without an integration team.

Local convenience does not weaken authorization, confirmation, or evidence requirements.

## 9. Relationship to other canons

- `AI_MUTATION_SAFETY_CANON_v1.md` governs proposal, preview, authorization, bounded execution, audit, and recovery for every state-changing step.
- `AGENT_PERMISSION_SYSTEM_CANON_v1.md` owns principal, role, grant, scope, expiry, and revocation semantics.
- `TOOL_GATEWAY_CANON_v1.md` owns adapter mediation and secret isolation.
- `EVIDENCE_BUNDLE_CANON_v1.md` owns trace integrity and evidence retrieval.
- `TELEGRAM_SERVERLESS_EDGE_CANON_v1.md` remains a non-authoritative channel edge and forwards agent-commerce requests to Tele•Ga Core.
- `TELE_GPT_CORE_STACK_v1.md` places the Agent Commerce Gateway below agent/interface surfaces and above canonical commerce/payment services.

Where a referenced canon is not yet present in the repository, this document preserves the required dependency name but does not redefine that canon's ownership.

## 10. Minimal implementation experiment

Run a sandbox-only pilot for one Aziz store assortment:

1. Merchant explicitly opts in three products for Tele•Fishka discovery.
2. Tele•Fishka declares its identity and requests only read/recommend/draft scopes.
3. The gateway returns a scoped catalog and creates a draft checkout proposal.
4. Buyer sees a RU/UZ preview and explicitly confirms.
5. Payment Authority issues a one-time sandbox Payment Intent Capsule.
6. Orders Core creates one canonical test order and returns a signed receipt.
7. Merchant revokes the grant and the next agent request is denied.

The pilot must test:

- unknown or undeclared agent;
- merchant opt-out and revoked grant;
- stale price, stock, capacity, and policy version;
- replayed idempotency key or payment capsule;
- wrong merchant, currency, provider, or amount;
- expired proposal and expired payment authority;
- buyer cancellation and platform kill switch;
- unavailable adapter causing user handoff instead of browser circumvention.

No production payment or live customer credential is permitted in this experiment.

## 11. Roadmap gates

### P0 — Contract and policy

- Define agent principals, merchant grants, proposal envelope, denial codes, and receipt schema.
- Connect all mutations to AI Mutation Safety and Evidence Bundle requirements.
- Implement merchant/platform kill switches and immediate revocation.

### P1 — Sandbox commerce

- Scoped Marketbase/catalog discovery.
- Draft cart/order and buyer preview.
- One-time sandbox Payment Intent Capsule.
- Signed execution receipt and denial telemetry.

### P2 — Local provider pilots

- Add one approved local payment adapter behind Payment Authority.
- Add provider-hosted confirmation and reconciliation.
- Expand to services/bookings only after product-order controls pass.

### P3 — Controlled ecosystem

- Publish a versioned agent-commerce adapter contract.
- Approve agents/publishers through registry and conformance tests.
- Expose merchant analytics for agent-driven discovery, conversion, denials, and recovered failures.

## 12. Acceptance criteria

This decision is implemented only when:

- undeclared or unapproved agents cannot obtain commerce scopes;
- merchant opt-in, scope limits, expiry, revocation, and kill switches are enforced server-side;
- every checkout begins as a typed proposal and materially changed proposals require reconfirmation;
- no agent receives reusable payment credentials;
- orders, bookings, inventory, customers, and payments remain owned by canonical domain services;
- adapter-first behavior and browser-fallback denial rules are test-covered;
- RU/UZ preview and receipts cover local payments and fulfillment;
- replay, amount mismatch, merchant mismatch, stale state, expired authority, and revoked consent fail closed;
- buyer and merchant can retrieve a complete evidence-backed receipt.

## 13. Explicit non-goals

This canon does not authorize:

- unrestricted scraping or general-purpose browser purchasing;
- silent merchant enrollment;
- autonomous substitution or price acceptance beyond buyer-approved bounds;
- storage of passwords, OTPs, card data, or payment-provider secrets in agent memory;
- a second cart/order/payment database inside Tele•Fishka, Telegram edge, or Agent Commerce Gateway;
- artificial lock-in through blocked export or withheld receipts.

---

**Canonical summary:** Tele•Ga welcomes AI-assisted commerce through declared identity, explicit merchant and buyer consent, typed proposals, bounded local payment authority, canonical execution, and verifiable receipts. Unknown or non-consensual automation is denied, not worked around.
