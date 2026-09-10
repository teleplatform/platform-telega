# Phase 6C.3A — Soft-Hint SHADOW Design

**DESIGN ONLY. No production routing influence. No LIMITED.**

> **Amendment (architecture review):** The original design re-computed
> production scores in the SHADOW observer by re-calling `rankProviders`.
> This was REJECTED — a second scoring pass could observe a different health
> snapshot, producing evidence that compares two different scoring runs
> instead of "base ranking + hint". The amended design uses a pure helper
> `applyPolicyHintToRanking(baseRanking, hint)` that adjusts the EXACT base
> scores from `DispatcherRoutingFacts.rankedProviders` (the ranking that
> production actually used). No re-computation. The 5 open questions are now
> resolved (§14).

---

## 0. Objective

Freeze the contract for hypothetical bounded soft-policy influence and define
the implementation plan for a new SHADOW experiment.

Dispatcher must be able to answer:

> **"If this approved soft policy hint had been applied to the existing
> production ranking, would the executable provider choice have changed?"**

Actual production selection must remain completely unchanged.

---

## 1. Frozen architectural decisions

`preferred_provider` and `required_provider` MUST NOT be used for Dispatcher
soft-policy authority.

Authority path MUST use explicit dependency injection. Module-level setter
remains allowed only for the existing observation-only SHADOW seam
(`setDispatcherRoutingObserver` at
`src/core/provider-selection-orchestrator.ts:143-151`).

Dispatcher expresses intent through:

```typescript
interface PolicyHint {
  preferredProviderId: ProviderId;
  strength: "tie_break" | "low";
  ruleId: string;
  ruleName?: string;
}
```

Dispatcher MUST NOT provide a numeric score adjustment. Production owns the
mapping from `strength` to influence magnitude.

For Phase 6C.3A:

```text
low       → fixed production-owned bounded additive bonus (candidate: +0.03)
tie_break → RESERVED / NOT ACTIVE
```

Do not finalize tie-break as any specific value. Design its future semantics
separately as an epsilon/near-equivalence mechanism.

The initial candidate value for `low` is `+0.03`, but **6C.3A exists to
validate that value in SHADOW**. It is not yet an approved LIMITED constant.

A hard internal ceiling exists (default `0.10`), but it MUST NOT be
configurable by Dispatcher rules or users.

---

## 2. Required SHADOW pipeline

```text
real request
    ↓
existing eligibility/capability filtering
    ↓
existing production base ranking
    ├──────────────────────→ ACTUAL selection (UNCHANGED)
    │
    └→ Dispatcher winner (from existing SHADOW observer)
          ↓
       PolicyHint
          ↓
     hypothetical policy adjustment
          ↓
     hypothetical adjusted ranking
          ↓
     hypothetical selection
          ↓
        evidence only
```

There MUST be no path from hypothetical selection back into actual
`selectedProviderId` or `fallbackOrder`.

The actual and hypothetical paths share the same base ranking result.
The hypothetical path applies a bounded adjustment to one provider's score
and re-sorts. The actual path is byte-identical to the current production
behavior.

---

## 3. Scoring ownership

Do not create a second scoring engine. Reuse the existing production
score/ranking result.

### 3.1 Current contracts (proven from code)

```typescript
// src/core/provider-scoring-engine.ts:160
function scoreProvider(providerId: string): RankedProvider | null;

// src/core/provider-scoring-engine.ts:196
function rankProviders(providerIds: string[]): ProviderRankingResult;

// src/core/provider-scoring-engine.ts:125
interface RankedProvider {
  providerId: string;
  score: number;
  breakdown: ProviderScoreBreakdown;
  rankingPosition: number;
  healthStatus: ProviderHealthStatus;
  eligible: boolean;
}

// src/core/provider-scoring-engine.ts:136
interface ProviderRankingResult {
  ranked: RankedProvider[];
  config: ProviderScoringConfig;
  timestamp: number;
  totalEligible: number;
  totalExcluded: number;
}
```

Scoring formula (`rankProviders` internal, `:181-183`):

```
score = availability × 0.35
      + latency      × 0.25
      + failureRate  × 0.20
      + priority     × 0.10
      + cost         × 0.10
```

Score range: **[0, 1.0]** (all components in [0,1], weights sum to 1.0).

### 3.2 API change

`rankProviders` signature is **unchanged**:

```typescript
function rankProviders(providerIds: string[]): ProviderRankingResult;
```

A new **pure helper** applies the policy hint to an existing base ranking.
It works with the simplified provider-score pairs already available in
`DispatcherRoutingFacts.rankedProviders`:

```typescript
function applyPolicyHintToRanking(
  baseRanking: readonly Array<{ providerId: ProviderId; score: number }>,
  hint: PolicyHint,
): PolicyAdjustedRanking;
```

This helper:
- adjusts only an already-eligible target;
- uses the production-owned `low` bonus (0.03);
- clamps adjusted score to 1.0;
- on equal adjusted score, preserves base rank order (array index);
- never mutates `baseRanking`;
- never selects an actual provider;
- has no Dispatcher/audit/request dependencies.

### 3.3 Adjusted ranking result

```typescript
interface PolicyAdjustedRanking {
  ranked: Array<{
    providerId: ProviderId;
    baseScore: number;
    adjustedScore: number;
    baseRank: number;
    adjustedRank: number;
  }>;
  hintApplied: boolean;
  preferredProviderId?: ProviderId;
}
```

`baseRank` is the provider's index in the input `baseRanking` array (0-based).
`adjustedRank` is its position after re-sorting by adjusted score.

### 3.4 Evidence types

The pure helper's `PolicyAdjustedRanking` (see §3.3 / `PolicyAdjustedRanking`
above) is complemented by derived evidence. The observer computes:

```typescript
interface PolicyRankingEvidence {
  preferredProviderId: ProviderId;
  strength: PolicyHint["strength"];
  baseScore: number;
  policyBonus: number;
  adjustedScore: number;
  baseRank: number;
  adjustedRank: number;
  decisionChanged: boolean;
  preferenceDefeated: boolean;
  eligibleProviderCount: number;
}
```

`rankProviders` is unchanged and does NOT return policy evidence — scoring
stays free of audit concerns. The helper returns `PolicyAdjustedRanking`;
the observer derives `PolicyRankingEvidence` from it. Neither the helper
nor `rankProviders` knows about `requestId`, timestamps, audit-store
writes, Dispatcher rules, or request lifecycle.

### 3.5 Production-owned bonus mapping

```typescript
const POLICY_HINT_BONUS: Record<PolicyHint["strength"], number> = {
  tie_break: 0, // RESERVED — not active in 6C.3A
  low: 0.03,    // Candidate value — to be validated in SHADOW
};

const POLICY_HINT_HARD_CEILING = 0.10;
```

The `low` value is production-owned configuration. Changing it requires
code modification and commit — it is NOT runtime-configurable by rules
or environment.

---

## 4. Score clamping analysis

### 4.1 Question

Should `adjustedScore` be clamped to `1.0`?

### 4.2 Analysis

The production score range is [0, 1.0]. With a `+0.03` bonus applied to a
provider already at 0.98, the adjusted score becomes 1.01. This exceeds the
documented range.

Clamping to 1.0 is recommended because:
1. `rankProviders` currently documents scores in [0, 1.0].
2. Downstream code may assume this invariant (e.g., display, logging).
3. Relative ordering is preserved — two providers clamped to 1.0 maintain
   their original relative order (the preferred provider was already close).
4. The bonus amount (0.03) is small enough that clamping to 1.0 does not
   create a significant cluster of providers at the ceiling.

### 4.3 Decision

**Yes, clamp.** `adjustedScore = Math.min(baseScore + bonus, 1.0)`.

**Clamped tie rule:** When adjusted scores are equal after clamping, preserve
base rank order. The policy hint must not win simply because clamping created
a new tie. Example:

```text
A base = 1.00, baseRank = 0
B base = 0.98, adjusted = min(0.98 + 0.03, 1.0) = 1.00, baseRank = 1

adjusted tie → A stays above B (base rank preserved)
```

This prevents clamping from introducing a hidden precedence mechanism.

Consequence: providers within 0.03 of 1.0 (i.e., base score ≥ 0.97) get a
clamped bonus. The ranking effect is preserved because the preferred provider
is already near the top. This is acceptable for the first SHADOW experiment.

If clamping proves problematic in 6C.3A results, it can be revisited.

---

## 5. Separation of responsibilities

### 5.1 Scoring layer (unchanged)

The existing `rankProviders` function is NOT modified. It computes base
scores and returns `ProviderRankingResult` exactly as today.

The pure helper `applyPolicyHintToRanking` is a separate function that
takes the simplified `{ providerId, score }[]` from the production ranking
and a `PolicyHint`, and returns a `PolicyAdjustedRanking`. It has no
knowledge of request context, audit, timestamps, or Dispatcher rules.

```text
rankProviders(eligible)                       // existing, unchanged
  → ProviderRankingResult.ranked              // base scores
    ↓ (mapped to { providerId, score }[])
DispatcherRoutingFacts.rankedProviders        // simplified pairs
    ↓
applyPolicyHintToRanking(baseRanking, hint)   // pure, production-owned
  → PolicyAdjustedRanking                     // evidence only
```

No request context. No audit writes. No timestamps. No Dispatcher rule
knowledge in either function.

### 5.2 Orchestration layer

Responsibility: enrich `PolicyRankingEvidence` into `PolicyDecisionRecord`,
store evidence, attach to event.

```typescript
interface PolicyDecisionRecord extends PolicyRankingEvidence {
  requestId: string;
  ruleId: string;
  ruleName?: string;
  timestamp: string;
}
```

The orchestration layer adds `requestId`, `ruleId`, `ruleName`, and
`timestamp` from the request context. It calls `appendAuditEvent` to
persist the record.

### 5.3 Concrete injection point

**6C.3A: no change to `planProviderSelectionV2` signature.** The hint is NOT
passed through the production selection path. Instead, the SHADOW observer
receives the base ranking from `DispatcherRoutingFacts` and calls the pure
helper directly.

```text
src/core/router.ts:270
  plan = selectProvider(model, options)     // UNCHANGED
    ↓
src/core/provider-selection-orchestrator.ts:567
  selectProvider(model, options)
    → parseRouteIntent(model, options)     // existing (:209-314)
    → planProviderSelectionV2(intent, requestId, registry)
                                        // existing (:435) — NO hint parameter
    → getDispatcherRoutingObserver()?.observe(facts)
                                        // existing (:610-628) — observer sees plan
```

Inside the observer (post-selection, SHADOW only):

```text
createDispatcherShadowObserver.observe(facts)
  → evaluateRoutingRules (existing)
  → IF outcome === "matched" AND eligible providers exist:
      → produce PolicyHint from winner
      → applyPolicyHintToRanking(facts.rankedProviders, hint)
                                        // pure helper, evidence only
      → compute hypothetical selection from adjusted ranking
      → emit PolicyDecisionRecord
    ELSE:
      → no hint, no hypothetical analysis
  → return { kind: "none }             // actual routing unchanged
```

The actual `selectedProviderId` and `fallbackOrder` in the returned
`ProviderSelectionPlan` are determined entirely by the existing production
path. The observer's hypothetical result is evidence-only — it never feeds
back into the plan.

### 5.4 No change to `src/core/router.ts`

`router.ts:270` calls `selectProvider` and receives a `ProviderSelectionPlan`.
The hypothetical analysis is internal to the orchestrator. `router.ts`
does not know about policy hints. The `ProviderSelectionPlan` interface
(`src/core/provider-selection-orchestrator.ts:89-103`) is unchanged.

### 5.5 SHADOW observer integration

The existing SHADOW observer (`src/server/dispatcher/dispatcher-shadow-observer.ts`)
already runs on every request when `isDispatcherShadowEnabled()` is true.
It calls `evaluateRoutingRules` and records divergence.

For 6C.3A, the observer is extended to also produce a `PolicyHint` from the
winning rule (when `outcome === "matched"`), then call `applyPolicyHintToRanking`
with the base ranking from `facts.rankedProviders`. The actual routing is
not changed.

The observer receives `DispatcherRoutingFacts` which includes the ranked
providers from the production path. It uses these EXACT base scores — no
re-scoring, no second pass through the scoring engine.

```text
createDispatcherShadowObserver.observe(facts)
  → evaluateRoutingRules (existing)
  → IF outcome === "matched":
      → produce PolicyHint from winner
      → applyPolicyHintToRanking(facts.rankedProviders, hint)
                                    // uses EXACT base scores from production
      → compute hypothetical selection from adjusted ranking
      → emit PolicyDecisionRecord
    ELSE:
      → no hint, no hypothetical analysis
  → return { kind: "none" }         // actual routing unchanged
```

**Critical invariant:** `facts.rankedProviders` contains the exact same
`RankedProvider[]` that the production scoring engine computed for this
request. The pure helper adjusts these scores — it never recomputes them.

---

## 6. Rule semantics

`evaluateRoutingRules` remains winner-only.

Exactly one winning Dispatcher rule may produce a `PolicyHint`.

Multiple hints, hint aggregation and competing-rule reconciliation are
OUT OF SCOPE.

Model selection remains independent from provider policy influence.
`planProviderSelectionV2` sets `selectedModel` from `intent.requestedModel`
(`:605`). Policy hint does not affect model choice.

---

## 7. Required evidence

6C.3A must replace convergence as the principal validation metric.

### 7.1 Aggregate metrics

```text
total_decisions            — total requests processed
hints_generated            — decisions with a winning Dispatcher rule
hints_eligible             — hints where preferred provider was eligible
hints_ineligible           — hints where preferred provider was NOT eligible

decision_impact_rate       — eligible hints that would have changed selection
hint_target_win_rate       — eligible hints where preferred provider would have won
preference_defeated_rate   — eligible hints where health/scoring overcame the hint

average_rank_delta         — mean |baseRank - adjustedRank| across eligible hints
max_rank_delta             — maximum |baseRank - adjustedRank|

average_base_score_gap    — mean (actual_winner_score - preferred_score) for eligible hints
average_flipped_score_gap  — mean (preferred_score - actual_winner_score) for flipped decisions
max_flipped_score_gap      — maximum (preferred_score - actual_winner_score) for flipped decisions

average_policy_bonus       — mean bonus applied (constant = 0.03 in 6C.3A)
max_policy_bonus           — maximum bonus applied

errors                     — count of evaluation failures
```

### 7.2 Per-decision evidence

For every hypothetical changed decision, evidence must make it possible
to reconstruct:

```text
requestId
actualProvider
hypotheticalProvider
baseScore
adjustedScore
baseRank
adjustedRank
ruleId
ruleName
strength
appliedBonus
eligibleProviderCount
timestamp
```

For every hypothetical unchanged decision, evidence records:

```text
requestId
actualProvider
baseScore
baseRank
ruleId
ruleName
strength
appliedBonus
eligibleProviderCount
timestamp
```

Do not log prompts, user content, API keys, credentials, or secrets.

---

## 8. Critical safety questions

### Q1: Can +0.03 overcome a materially worse health score?

**No.** After 1 failure: failureRate penalty ≈ 0.033 (1/6 × 0.20). A +0.03
bonus roughly offsets this. After 2 failures: penalty ≈ 0.067, which overwhelms
the bonus. After 5 failures: circuit opens, provider excluded from eligible
set entirely — hint never reaches it.

### Q2: Can it overcome a materially worse latency score?

**Partially, within narrow range.** Latency weight is 0.25. At default floor=100ms,
ceiling=5000ms: a 150ms latency difference → 0.25 × (150/4900) ≈ 0.0077 score
difference. +0.03 can overcome this. A 600ms difference → 0.031, which the bonus
cannot overcome.

### Q3: Can it overcome cost preference?

**Rarely.** Cost weight is 0.10. free→cheap = 0.025 difference, cheap→standard = 0.025,
standard→premium = 0.025. +0.03 can flip free↔cheap (0.025) but not
cheap↔standard when combined with other penalties. In isolation, +0.03 can
overcome exactly one cost-class step.

### Q4: What base-score gap is the maximum that low can flip?

**0.03.** The maximum gap the bonus can overcome is exactly the bonus value itself
(when all other factors are equal). In practice, the effective maximum is
slightly less because providers with identical base scores are already tied.

### Q5: Should adjusted scores be clamped?

**Yes.** See §4. `Math.min(baseScore + bonus, 1.0)` preserves relative ordering
within the [0, 1.0] documented range.

### Q6: What happens when the preferred target is ineligible?

No hint is produced (the observer only emits a hint when the winner's
`routeTo` is in `facts.eligibleProviders`). `applyPolicyHintToRanking` is
never called with an ineligible target. No hypothetical analysis is produced.

### Q7: What happens when there is only one eligible provider?

The base ranking has one entry. `applyPolicyHintToRanking` adjusts its
score (if it is the preferred target), but the sole eligible provider
remains the hypothetical selection. `decisionChanged` is `false`
(same provider selected). `hypotheticalProvider === actualProvider`.

### Q8: What happens on equal adjusted scores?

Base rank order is preserved. The provider that was higher in the
`DispatcherRoutingFacts.rankedProviders` array (lower base rank) stays
above on equal adjusted scores. The policy hint must not win from a
clamping-induced or bonus-induced tie.

### Q9: Does the existing stable tie-breaking order remain deterministic?

**Yes.** The pure helper sorts by adjusted score descending; equal adjusted
scores retain input-array order (stable sort, V8/Node.js). Since the input
array is the exact production ranking, the base position is never perturbed
by the hint except through a genuine score improvement.

### Q10: Can any failure in policy evaluation change actual routing?

**No.** In SHADOW mode, policy evaluation is entirely hypothetical.
The actual `selectedProviderId` and `fallbackOrder` are determined before
the hint is evaluated. The hint only produces evidence. Failures in hint
evaluation are caught and logged; actual routing proceeds unchanged.

---

## 9. SHADOW acceptance target

Do NOT define a desired hint-target win rate.

Success means:

- actual routing is byte-for-byte / plan-for-plan unchanged;
- hypothetical influence is deterministic (same input → same output);
- influence is bounded (hard ceiling enforced);
- hypothetical branch uses the exact production base scores — no second
  scoring pass, no recomputing of health/capability inputs;
- base rank is preserved on equal adjusted scores (no clamping-induced wins);
- ineligible providers never become hypothetical executable choices;
- existing production health/capability constraints remain authoritative;
- evidence explains every hypothetical changed decision;
- failures are fail-open (hint evaluation failure → no hint, actual routing
  unchanged);
- kill switch completely disables policy evaluation;
- no new routing authority is introduced;
- adjusted scores never exceed 1.0;
- preference is defeated by health penalties (this is expected, not a failure).

---

## 10. Deliverable

Create:

```
docs/dispatcher/PHASE-6C3A-SOFT-HINT-SHADOW-DESIGN.md
```

The document must finish with:

- frozen `PolicyHint` contract;
- proposed scoring-layer contract (`applyPolicyHintToRanking` signature,
  `POLICY_HINT_BONUS` mapping, `PolicyAdjustedRanking`);
- proposed orchestration/evidence contract (`PolicyDecisionRecord`);
- exact injection points (with file:line references);
- exact files future implementation would modify/add;
- test matrix;
- replay/evidence plan;
- rollback/kill-switch behavior;
- resolved questions (§14);
- explicit **GO / NO-GO criteria for implementing 6C.3A SHADOW**.

---

## 11. Test matrix

### 11.1 Unit tests

| Category | Cases | Notes |
|---|---|---|
| `rankProviders` signature unchanged (no hint param) | existing behavior byte-identical | backward compatibility |
| `applyPolicyHintToRanking` with hint, preferred eligible | bonus applied, adjustedScore = base + 0.03, clamped to 1.0 | core behavior |
| `applyPolicyHintToRanking`, preferred NOT in ranking | no bonus applied, output identical to input order | ineligible path |
| `applyPolicyHintToRanking`, preferred at position 0 already | bonus applied, no rank change | best-case already |
| `applyPolicyHintToRanking`, preferred can flip one provider | baseRank 1 → adjustedRank 0, decisionChanged = true | minimal impact |
| `applyPolicyHintToRanking`, preferred CANNOT flip (gap > 0.03) | preferenceDefeated = true | health penalty wins |
| `applyPolicyHintToRanking`, multiple providers near top | only preferred gets bonus, others unchanged | selective influence |
| `applyPolicyHintToRanking`, bonus pushes score above 1.0 | clamped to 1.0, ranking correct | clamping |
| `applyPolicyHintToRanking`, single eligible provider | bonus applied, decisionChanged = false | trivial case |
| `applyPolicyHintToRanking`, adjusted tie after clamping | base rank preserved (A above B) | tie-breaking |
| `applyPolicyHintToRanking` does not mutate input | input array unchanged after call | immutability |
| `applyPolicyHintToRanking` never selects a provider | returns ranking only, no selection | authority boundary |
| PolicyHint type: bonus is NOT a field | type error if someone tries to set numeric bonus | contract enforcement |
| PolicyDecisionRecord enrichment | requestId, ruleId, ruleName, timestamp added | orchestration layer |
| Observer uses exact facts.rankedProviders (no re-scoring) | same providerIds, same scores as production | no second pass |

### 11.2 Integration tests

| Category | Cases |
|---|---|
| SHADOW observer produces PolicyHint from winning rule | hint present in evidence |
| SHADOW observer, no winning rule | no hint, no hypothetical analysis |
| SHADOW observer, hint ineligible | no hypothetical analysis |
| Kill switch engaged | no policy evaluation, no hypothetical analysis |
| Mode = OFF | no policy evaluation, no hypothetical analysis |
| Request-scoped evidence contains PolicyDecisionRecord | audit event emitted |
| Actual ProviderSelectionPlan unchanged with/without hint | byte-identical |

### 11.3 Regression

| Test | Source |
|---|---|
| STRONG semantics: preferred provider eligible but lower-scored still wins | `tests/unit/provider/providerSelectionOrchestrator.test.ts` — must remain green |
| All existing 6C.1 shadow tests | `tests/dispatcher/dispatcher-6c-shadow.test.ts` — 16/16 |
| All existing provider scoring tests | `tests/unit/provider/` — no regressions |

---

## 12. Replay / evidence plan

### 12.1 Deterministic replay (offline)

Replay existing `shadow-observation-run.ts` data through the hypothetical
pipeline:

1. Load NDJSON from `shadow-observation-run.ts` output.
2. For each decision: extract `eligible` provider list and base ranking.
3. Produce `PolicyHint` from the winning rule (same logic as shadow observer).
4. Compute hypothetical adjusted ranking.
5. Compare against actual selection.
6. Aggregate metrics.

This does NOT require live traffic. It can run offline against existing data.

### 12.2 Live SHADOW observation

When 6C.3A is deployed, the shadow observer automatically produces
`PolicyDecisionRecord` on every request where a Dispatcher rule matches.
Evidence is written to the existing audit trail.

After a calibration window (e.g., 1–2 weeks), aggregate metrics are
generated from live evidence.

---

## 13. Rollback / kill-switch behavior

| Action | Effect |
|---|---|
| Kill switch engaged (`/dispatcher/routing/kill-switch` POST) | `isDispatcherShadowEnabled()` returns false → observer short-circuits → no policy evaluation → no hypothetical analysis |
| Mode set to OFF (`setDispatcher6CMode("off")`) | Same as kill switch — observer is completely bypassed |
| Observer disabled / no winning rule | `applyPolicyHintToRanking` never invoked; no bonus, no evidence |
| Hint evaluation throws exception | Caught in observer; `appendAuditEvent` with `routing.dispatcher.error`; actual routing unchanged |
| Bonus value changed in code | Requires code commit — not runtime configurable |

All rollback paths result in zero actual routing impact. The SHADOW experiment
is purely observational.

---

## 14. Resolved questions

1. **Observer location:** post-selection for 6C.3A SHADOW only. The existing
   `createDispatcherShadowObserver.observe()` is extended. For future
   LIMITED, a separate pre-selection explicit-DI seam will be designed.

2. **Hypothetical computation site:** pure production-owned helper
   `applyPolicyHintToRanking(...)` adjacent to the scoring engine
   (`src/core/provider-scoring-engine.ts`). It knows nothing about
   Dispatcher, audit, or requestId.

3. **Re-call rankProviders:** rejected. The observer uses the exact
   `{ providerId, score }[]` from `DispatcherRoutingFacts.rankedProviders`
   — the same scores that production used for actual selection. No
   second scoring pass.

4. **Clamped tie:** preserve base rank. When adjusted scores are equal
   after clamping, the provider with the lower base rank (higher position
   in the original array) stays above. Policy hint must not win from a
   clamping-induced tie.

5. **Minimum impact rate:** none required. Even 0% impact is a valid
   SHADOW result (it means the bonus is too small to flip any decisions
   under current scoring conditions). Acceptance requires sufficient
   scenario coverage and evidence quality, not a specific impact number.

---

## 15. GO / NO-GO criteria for implementing 6C.3A SHADOW

| Criterion | Status | Gate |
|---|---|---|
| `PolicyHint` type exists with `strength: "tie_break" \| "low"` | 🟡 | required |
| `POLICY_HINT_BONUS` constant maps `low → 0.03` | 🟡 | required |
| `POLICY_HINT_HARD_CEILING = 0.10` exists and is enforced | 🟡 | required |
| `rankProviders` signature UNCHANGED (no hint parameter) | 🟡 | required |
| `applyPolicyHintToRanking(baseRanking, hint)` pure helper exists | 🟡 | required |
| Helper adjusts only eligible targets | 🟡 | required |
| Bonus clamped to `Math.min(base + bonus, 1.0)` | 🟡 | required |
| Clamped ties preserve base rank order | 🟡 | required |
| Helper never selects an actual provider | 🟡 | required |
| No re-call of `rankProviders` in the hypothetical branch | 🟡 | required |
| Observer uses exact `DispatcherRoutingFacts.rankedProviders` scores | 🟡 | required |
| `PolicyDecisionRecord` emitted by observer (evidence only) | 🟡 | required |
| Actual `ProviderSelectionPlan` unchanged when hint present | 🟡 | required |
| STRONG semantics regression test green | 🟡 | required |
| All existing 6C.1 tests green | 🟡 | required |
| Kill switch disables policy evaluation | 🟡 | required |
| No new TypeScript errors against current baseline | 🟡 | required |
| Offline replay covers all SHADOW scenarios (fresh/degraded/circuit/tie/single) | 🟡 | required |
| `preference_defeated_rate > 0%` in offline replay | 🟡 | soft signal |
| No `health_override_risk` in offline replay | 🟡 | required |
| No runtime-configurable bonus (code change only) | 🟡 | required |
