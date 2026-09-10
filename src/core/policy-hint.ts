/**
 * Phase 6C.3A — Soft-Policy Hint (SHADOW ONLY)
 *
 * Pure, dependency-free contract for hypothetical bounded policy influence.
 *
 * Rules of this module:
 *  - never calls rankProviders / scoreProvider (no second scoring pass);
 *  - never recomputes health/capability/scoring facts;
 *  - never mutates the base ranking input;
 *  - adjusts only a provider already present in the base ranking;
 *  - uses a production-owned bounded bonus (Dispatcher never provides numbers);
 *  - clamps adjusted scores to 1.0;
 *  - equal adjusted scores preserve the original base rank order;
 *  - never returns or assigns an actual production selection;
 *  - has no Dispatcher, audit-store, requestId, or server dependencies.
 */

import type { ProviderId } from "./provider-resolution.js";

export type PolicyHintStrength = "tie_break" | "low";

/**
 * Frozen Dispatcher soft-policy hint. Dispatcher expresses INTENT only;
 * production owns the number. `tie_break` is RESERVED (inactive); `low` is
 * the only active SHADOW strength.
 */
export interface PolicyHint {
  preferredProviderId: ProviderId;
  strength: PolicyHintStrength;
  ruleId: string;
  ruleName?: string;
}

/** Production-owned mapping of strength → bounded additive score bonus. */
export const POLICY_HINT_BONUS: Readonly<Record<PolicyHintStrength, number>> = {
  tie_break: 0, // RESERVED — epsilon/near-equivalence semantics not yet designed
  low: 0.03, // Candidate SHADOW value — not yet an approved LIMITED constant
};

/**
 * Hard internal ceiling for the policy influence on a single provider score.
 * MUST NOT be configurable by Dispatcher rules or users.
 */
export const POLICY_HINT_HARD_CEILING = 0.10;

export interface PolicyAdjustedEntry {
  providerId: ProviderId;
  baseScore: number;
  adjustedScore: number;
  baseRank: number;
  adjustedRank: number;
}

export interface PolicyAdjustedRanking {
  ranked: PolicyAdjustedEntry[];
  hintApplied: boolean;
  preferredProviderId: ProviderId;
}

/**
 * Pure production-owned helper.
 *
 * Applies a bounded additive bonus to the preferred provider's base score in
 * an EXISTING ranked result, then re-sorts. The input is the exact ranking
 * that production used for actual selection — never re-scored here.
 *
 * @param baseRanking the immutable base ranking (already sorted by production
 *   scoring). baseRank is the provider's index in this array.
 * @param hint        the Dispatcher intent (strength → production-owned bonus).
 */
export function applyPolicyHintToRanking(
  baseRanking: ReadonlyArray<{ providerId: ProviderId; score: number }>,
  hint: PolicyHint,
): PolicyAdjustedRanking {
  const entries = baseRanking.map((p, baseRank) => {
    const target = p.providerId === hint.preferredProviderId;
    const rawBonus = target ? POLICY_HINT_BONUS[hint.strength] ?? 0 : 0;
    const bonus = Math.min(Math.max(rawBonus, 0), POLICY_HINT_HARD_CEILING);
    return {
      providerId: p.providerId,
      baseScore: p.score,
      adjustedScore: Math.min(p.score + bonus, 1.0),
      baseRank,
      adjustedRank: 0,
      appliedBonus: bonus,
    };
  });

  const hintApplied = entries.some((e) => e.appliedBonus > 0);

  // Stable sort: descending adjustedScore; equal → preserve base rank order.
  entries.sort((a, b) => {
    if (b.adjustedScore !== a.adjustedScore) {
      return b.adjustedScore - a.adjustedScore;
    }
    return a.baseRank - b.baseRank;
  });

  entries.forEach((entry, adjustedRank) => {
    entry.adjustedRank = adjustedRank;
  });

  return {
    ranked: entries.map(({ providerId, baseScore, adjustedScore, baseRank, adjustedRank }) => ({
      providerId,
      baseScore,
      adjustedScore,
      baseRank,
      adjustedRank,
    })),
    hintApplied,
    preferredProviderId: hint.preferredProviderId,
  };
}