# PD-W2/A1 — Capability & Dispatch vNext Architecture

Canonical baseline: `runtime-recovery-baseline-v1` → `fdfdae9` → **LOCKED**
Phase: **Architecture Gate — read-only design**. No product source changed.

---

## 1. Executive Decision

The canonical model **splits two concerns that were previously conflated** in the legacy
`src/runtime/capability` module:

- **Runtime Availability / Target Health** (legacy `RuntimeTarget`, `CapabilityProfile`,
  `online/degraded/offline`, `getOnlineProfiles`, `listCapabilityProfiles`) → extract into an
  explicit **Availability** authority.
- **Action Capability / Permission / Trust** (proposed `CapabilityRegistry`, `CapabilityKind`,
  `CapabilityTrustLevel`, `CapabilityPermissions`) → the **capability** authority.

These MUST NOT be merged or presented as one truth. Dispatch sits **after** both, as an
orchestrator that reads capability + availability + permission and selects a route.

**Commitment:** no new HTTP/UI/Adapter contract unless a later gate proves one necessary
(see Contract Decision). Baseline security invariants are preserved exactly.

---

## 2. Canonical Models

### A. Availability (extract of legacy) — `runtime/availability`
Owns: *"is runtime target X reachable/healthy right now and what surfaces does it serve?"*
- Truth: **runtime transport availability** (static declared kind + dynamic health status).
- Entities:
  ```
  RuntimeTarget       := "kilo_mcp" | "forge_http" | "local" | "openai" | "telegram" | string
  AvailabilityStatus  := "online" | "degraded" | "offline"
  TargetProfile       := { target: RuntimeTarget; status: AvailabilityStatus; local?: boolean;
                            surfaces?: string[] }
  TargetAvailabilityRegistry { get(target); online(target):boolean; all(): TargetProfile[] }
  ```
- Key: `RuntimeTarget`.
- Static vs dynamic: declaration of what a target is + can serve is static; `status` is dynamic
  health state updated by the Health/evidence layer.
- Observational: **yes** (this is a health report). Authoritative for availability only.
- Changes dynamically: `status` transitions (online↔offline↔degraded) via evidence-backed signals.
- Security-sensitive: none by itself (availability is not permission).

### B. Action Capability — `runtime/capability`
Owns: *"can the system perform action capability Y, and under what permission/trust profile?"*
- Truth: **static security/action capability declaration.** Not availability.
- Entities:
  ```
  CapabilityKind      := "model" | "web_provider" | "sigma_forge" | "browser_agent"
                         | "voice_runtime" | "mission_control" | "repo" | "terminal"
                         | "validator" | "memory" | "deployment" | ...
  CapabilityTrustLevel:= "core" | "trusted" | "external" | "experimental"
  CapabilityDescriptor := { capability_id; kind; route: ActionRouteKind; title; description;
                            provider: CapabilityProvider; permissions: CapabilityPermissions;
                            evidence_required; validator_required; reversible; enabled }
  CapabilityRegistry  { register(d); resolve(route, kind?); list(); listEnabled() }
  ```
- Keys: `capability_id`, indexed by `(route, kind)`.
- Static vs dynamic: descriptors are **static declaration**; registry membership is populated at
  startup/fixture time. `enabled` is a soft operational toggle, not availability.
- Observational: NO — this is **declarative/authoritative** about what actions exist.
  Authoritative **only for capability existence/definition**, never for "is it up right now".
- Changes dynamically: registry contents change only when capabilities are registered/unregistered.
- Security-sensitive: YES — `permissions`, `trust_level` are trust-equivalent and must come only
  from trusted registration (fixtures/core), never from self-asserted input.

### C. Permission / AuthZ — `core/authz` + `core/auth` (unchanged authority)
Owns: *"is ACTOR allowed to invoke capability Y?"*
- Already hardened (`server/runtime` baseline security LOCK). CapabilityRegistry is NOT an
  authorization store; permission is resolved by the existing authz guard against an actor.

### D. Dispatch — `runtime/dispatch`
Owns: *"given an intent, which route should execute it, given capability+permission+availability?"*
- Not a truth owner; a **resolver/selector** reading the authorities above.

---

## 3. Authority Matrix

| Question | Authority | Notes |
|---|---|---|
| "Is target X online?" | **Availability** (`runtime/availability`) | health-backed; NOT capability |
| "Can the system perform capability Y?" | **Capability** registry | static declaration |
| "Is actor allowed to invoke Y?" | **AuthZ / Auth** (actor-based) | hardened, unchanged |
| "Which runtime target should execute Y?" | **Availability + selection** | availability narrows eligible targets |
| "Which provider supports Y?" | **Provider OS** (`runtime/provider`) | unchanged — do NOT duplicate in CapabilityRegistry |
| "Which route should Dispatch choose?" | **Dispatch** (orchestrator) | post capability+permission+availability |
| "Capability Y's permission/trust profile" | **Capability** descriptor | static, registration-trusted |

**Anti-dual-authority rules:**
- CapabilityRegistry does NOT score/rank providers (Provider OS owns that).
- Availability does NOT grant permission.
- Dispatch does NOT invent capability truth, own provider scoring, bypass auth/policy, or mutate
  health state without evidence.

---

## 4. Dispatch Pipeline (canonical flow)

```
Intent (runtime/intent) ────────────────► IntentResult{intent, goal, risk, recommended_route}
   ↓
Capability resolve (runtime/capability) ─► capability descriptors → required_route (ActionRouteKind)
   ↓
Permission / policy gate (core/authz/auth + PolicyGate) ─► actor may invoke this capability/route?
   ↓
Availability (runtime/availability) ───► eligible execution targets for the route (online subset)
   ↓
Provider selection (runtime/provider + Provider OS) ─► concrete provider for chosen target
   ↓
Route dispatch (runtime/dispatch) ──────► DispatchResult{route,status,output,evidence}
   ↓
Execution → Delivery → Evidence (runtime/evidence)
```

Stage ownership:
- Intent → Capability requirement: runtime/intent + capability resolve.
- Permission/trust gate: core/authz/auth (NOT dispatch).
- Runtime availability: runtime/availability.
- Provider/target selection: runtime/provider + provider OS, constrained by availability-eligible targets.
- Dispatch: runtime/dispatch picks `ActionRouteKind` and hands off to an executor bound to that route.

Dispatch boundary guards (explicit do-not-dos, as mandated):
- Does NOT invent capability truth.
- Does NOT own provider scoring.
- Does NOT bypass auth/policy.
- Does NOT infer availability from permissions.
- Does NOT mutate health state without evidence.

---

## 5. Relation to Existing Systems

| System | Input → Cap/Dispatch | Output ← Cap/Dispatch | Relation |
|---|---|---|---|
| runtime/intent | IntentResult → capability resolve | — | feeds capability requirement |
| core/authz + core/auth | actor + capability_id | allowed? (gate) | pre-dispatch permission |
| PolicyGate | route/action | policy allow | quota/rate, not authN |
| runtime/provider | selected target | capability requests a route | dispatch selects, provider executes |
| Provider Quality | execution outcome evidence | — | observational, post hoc |
| runtime/mode | — | capability may read mode | mode policy independent; no overlap |
| runtime/context | — | dispatch may attach context | context independent |
| runtime/memory | — | dispatch result memory | independent |
| Forge / Agents / Tools | executors | dispatch hands route to executor | consumers of dispatch |
| runtime/evidence | — | dispatch emits result evidence | audit trail |
| runtime/health | availability signals | — | health feeds Availability status |
| runtime/ops | operational freeze/baseline | availability snapshot | reads Availability (post-extraction) |
| replay/evidence | — | availability; target override | uses Availability after migration |

---

## 6. Compatibility Policy

Decision: **rename-and-migrate, no fabrication.**

The legacy `getOnlineProfiles` on the baseline must be preserved for the existing 8 committed
consumers until availability extraction lands, but implemented by the new Availability registry —
**only where the source truth genuinely exists**. Where it does not (legacy reported hardcoded
`kilo_mcp:online/forge_http:degraded`), the Availability model must carry those **real declared
baseline statuses as its own initial data**, not pretend the Capability model produced them.

Rule: **No compatibility layer may fabricate a field the source model does not possess.**
Capability and Availability are separate; a bridge from one to the other is only legal for
concepts both literally share (e.g., a RouteKind → target map), never for availability-permission.

Temporary shim allowed only on the baseline transition, explicitly deprecated after migration.

---

## 7. Contract Surface

Decision:
- **Internal TypeScript contracts:** YES (new modules are internal).
- **Runtime HTTP contracts:** NO new endpoint. If an ops/admin read is later wanted it must pass a
  separate product gate. Existing `/health`/`/ready` surface unchanged.
- **Adapter contracts:** NO.
- **UI contracts:** NO. Do NOT expose CapabilityRegistry as an admin UI just because it exists.

---

## 8. Security Invariants (Capability ≠ Permission)

Distinguish (and keep explicit in code/types):
1. Capability existence (declared).
2. Actor authorization (authz resolves actor permission, server-verified).
3. Provider/tool safety level (`CapabilityProvider.trust_level`, `CapabilityPermissions`).
4. Runtime availability (health).
5. Execution approval (evidence/hitl/mission-approval).

Invariants:
- No self-asserted identity → no trusted authZ. (Baseline auth LOCK preserved.)
- No `capability → permission` shortcut: a capability existing does NOT authorize any actor.
- No availability → permission: an online target does not grant access.
- Private/public surface is determined by authz, not by presence of a capability in the registry.

---

## 9. Archive Reuse Matrix (read source archive as evidence only)

| Artifact | Verdict | Note |
|---|---|---|
| Legacy `runtime/capability` (profile model) | **ADAPT → rename to availability** | availability semantics; baseline consumers migrate to Availability |
| Archive `CapabilityKind`/`TrustLevel`/`Permissions`/`Descriptor` shape | **REUSE** | clean security/action model; align `kind` union recursively to final canonical |
| Archive `CapabilityRegistry.register/resolve/list` | **REUSE (ADAPT API)** | drop the unrelated route-tie unless genuine; keep registration-trusted only |
| Archive `dispatch/{dispatch-runtime,dispatch-handlers,index}` | **ADAPT** | dispatch is empty on baseline; reuse as orchestration starting point bound to canonical authorities, NOT to stale `routeChat` legacy seam |
| Archive `dispatch-model-forwarding.test.ts` | **TEST_ONLY** | rewrite against canonical pipeline; do not port wholesale |
| Archive runtime/health+ops | **REUSE-as-availability-consumer** | move `getOnlineProfiles` consumers onto Availability |
| `runtime/evidence/replay-*` + `runtime-preflight-gate` (RuntimeTarget type) | **MIGRATE type** | re-type `RuntimeTarget`/target_override from Availability |
| Archive dual-model conflation | **CONFLICTS_WITH_CANON** | do NOT reintroduce |
| Compile-time telegram-coupled `server/index.ts` | **STALE on canonical** | already decoupled in baseline; keep out |

**Do NOT copy files wholesale.** Port concepts, re-key to canonical unions/roles, re-wire to
Availability + Capability + Dispatch + Provider authorities.

---

## 10. Implementation Sequence (proposed, dependency-derived)

- **A1** (this gate) — architecture decision + this document.
- **A2** — land **Availability** model (`runtime/availability`) plus a compatibility shim that keeps
  the existing `runtime/capability` legacy exports working *unchanged* (old name, new Availability
  truth) — **only adding, not breaking** the baseline's 8 committed consumers.
- **A3** — introduce **CapabilityRegistry vNext** (`runtime/capability` new API) alongside, as pure
  additive internal module; **NO consumer churn yet**; gate: full baseline build stays green.
- **A4** — **Dispatch vNext** (`runtime/dispatch`) bound to Capability + Permission + Availability +
  Provider, replacing the legacy `routeChat` seam as the canonical route resolver (new path, no
  rewrite of Provider OS).
- **A5** — migrate the 8 archive/baseline consumers:
  - `runtime/health/runtime-baseline`, `runtime/health/runtime-health-aggregator`,
    `runtime/ops/operational-baseline-freeze` → Availability.
  - `runtime/evidence/replay-*`, `runtime-preflight-gate` types → Availability(`RuntimeTarget`).
- **A6** — drop legacy `runtime/capability` exports after migration; delete compatibility shim.
- **A7** — Acceptance + lock (new baseline tag).

---

## 11. Acceptance Gates

- A2/A3: full `tsc -p tsconfig.server.json` stays 0 errors; isolated `/health` `/ready` boot passes.
- A2 shim: all 8 legacy consumers compile and behave unchanged (no behavior regression).
- A4: dispatch resolves a representative action end-to-end: intent → capability → auth gate →
  availability → provider → dispatch → evidence.
- A5: migration lands atomically; legacy `capability` exports removed only after all 8 consumers
  run on Availability.
- Security: authz negative matrix still 401 for unverified/self-asserted. No capability→permission.
- Lock: emit a new canonical baseline tag `runtime-recovery-baseline-v1`+ (or v2) with doc + tests.

---

## 12. Explicit Non-Goals (this program)

- Do NOT migrate Telegram/Kilo (W1) before capability/dispatch lock (A7).
- Do NOT build an admin UI for capability registry.
- Do NOT add HTTP/Adapter/UI contracts (unless a later PD gate lifts this).
- Do NOT make CapabilityRegistry a provider-scoring/ranking engine.
- Do NOT reintroduce the legacy conflation or dual-authority for capability+availability.
- Do NOT recover the dirty archive as if it were current tree; build only on baseline.
- Do NOT make Dispatch own auth/policy/health-scoring.

---

## 13. Next Gate

**PD-W2/A2** — implement the Availability model + compatibility shim (additive, baseline-green),
leaving CapabilityRegistry vNext for A3 and Dispatch vNext for A4.

---

## 14. A7 Acceptance Lock Record (executed)

Repair program executed end-to-end on `integration/runtime-recovery-index`.

| Gate | Commit | Result |
|---|---|---|
| A2 Availability + compat shim | `88887b8` | 16/16 availability; shim kept legacy exports green |
| A3 CapabilityRegistry vNext | `720269a` | 21/21 capability-vnext |
| A4 Dispatch vNext planning | `5a9ea7d` | 17/17 dispatch-planner |
| A5 Safe execution + migration | `c5ea51a` `f49d82e` | 16/16 safe-execution + LIVE E2E PASS (real outcome, real evidence chain) |
| A6 Legacy retirement | `5172cc6` | legacy `runtime/capability` + tsconfig exclude deleted; 0 importers remain |

**Final verification (A7):**
- Full server tsc (0 errors), scoped strict tsc over dispatch/capability domain clean.
- Isolated boot: `/health` 200, `/ready` 200; legacy dispatch HTTP surface 404; no legacy residue in boot log.
- Program-arc suites: availability 9/9, capability-vnext 21/21, dispatch-planner 17/17,
  safe-execution 16/16 (repeated runs, pid-unique traces), live E2E PASS.
- Authz negative matrix (no capability→permission, unverified/self-asserted denied):
  actor 25/25, guard 13/13, modes 20/20, permissionResolver 12/12, permissions 17/17,
  profiles 24/24, providerTool 26/26.
- Gateway boot: gateway 20/20, gatewayStartup 5/5, providerHealthDiagnostics 14/14.
- Guarded authorities (availability, capability-vnext, provider, authz, auth, router, evidence,
  health, ops semantics) unmodified beyond sanctioned consumer re-pointing.

**Lock tag:** `runtime-recovery-baseline-v2` at `5172cc6`.
**Explicit non-goals honored:** no HTTP/Adapter/UI contract; no Telegram/Kilo migration; no archive
recovery; no provider scoring inside Dispatch; no capability→permission shortcut.
