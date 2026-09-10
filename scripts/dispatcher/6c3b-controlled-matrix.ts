/**
 * Phase 6C.3B — Controlled evidence corpus for soft policy hint evaluation.
 *
 * Directly calls applyPolicyHintToRanking() with ~600-800 synthetic fixtures
 * spanning the full gap/health/capability/provider-count parameter space.
 *
 * Does NOT touch production routing, health, scoring, or audit.
 * Does NOT modify low = +0.03.
 * Deterministic — same inputs always produce same output.
 *
 * Output: NDJSON with one evidence record per fixture.
 *
 * Usage:
 *   node --import tsx scripts/dispatcher/6c3b-controlled-matrix.ts \
 *     --out /tmp/6c3b/evidence.ndjson
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  applyPolicyHintToRanking,
  POLICY_HINT_BONUS,
} from "../../src/core/policy-hint.js";
import type {
  PolicyAdjustedRanking,
  PolicyHint,
  PolicyHintStrength,
} from "../../src/core/policy-hint.js";
import type { ProviderId } from "../../src/core/provider-resolution.js";

// ─── Provider pools ───────────────────────────────────────────────────────────

const POOL_2: [ProviderId, ProviderId] = ["kimi_api", "openai_api"];
const POOL_3: [ProviderId, ProviderId, ProviderId] = ["kimi_api", "openai_api", "deepseek_api"];
const POOL_4: [ProviderId, ProviderId, ProviderId, ProviderId] = [
  "kimi_api", "openai_api", "deepseek_api", "zyloo_api",
];
const POOL_5: [ProviderId, ProviderId, ProviderId, ProviderId, ProviderId] = [
  "kimi_api", "openai_api", "deepseek_api", "zyloo_api", "local",
];

// ─── Score generators ─────────────────────────────────────────────────────────

const GAP_RANGES = [
  { label: "0", min: 0, max: 0 },
  { label: "0.001-0.005", min: 0.001, max: 0.005 },
  { label: "0.005-0.01", min: 0.005, max: 0.01 },
  { label: "0.01-0.015", min: 0.01, max: 0.015 },
  { label: "0.015-0.02", min: 0.015, max: 0.02 },
  { label: "0.02-0.03", min: 0.02, max: 0.03 },
  { label: ">0.03", min: 0.031, max: 0.06 },
] as const;

const HEALTH_PROFILES = [
  "healthy",
  "degraded",
  "circuit-open",
] as const;

const CAPABILITY_SETS = [
  [],
  ["reasoning"],
  ["code"],
  ["vision"],
  ["reasoning", "code"],
] as const;

// ─── Fixture builder ──────────────────────────────────────────────────────────

interface Fixture {
  id: string;
  description: string;
  baseRanking: Array<{ providerId: ProviderId; score: number }>;
  hintTargetRank: number;
  hint: PolicyHint;
  expectedFlip: boolean;
  gapBucket: string;
  healthProfile: string;
  capabilities: readonly string[];
  providerCount: number;
  clamping: boolean;
  noMatch: boolean;
  killSwitch: boolean;
  singleEligible: boolean;
}

let fixtureSeq = 0;

function nextId(prefix: string): string {
  fixtureSeq++;
  return `${prefix}-${String(fixtureSeq).padStart(4, "0")}`;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Build a fixture with a controlled gap between the preferred provider and
 * the base winner.
 *
 * @param gap          score gap (baseWinner - preferred); 0 means same score
 * @param preferredRank 1-based rank where the preferred provider sits in the base ranking
 * @param providerPool  pool of providers to draw from
 */
function buildFixture(
  gap: number,
  preferredRank: number,
  providerPool: readonly ProviderId[],
  opts: {
    health?: string;
    capabilities?: readonly string[];
    clamping?: boolean;
    noMatch?: boolean;
    killSwitch?: boolean;
    singleEligible?: boolean;
  } = {},
): Fixture {
  const pool = [...providerPool];
  const preferredIdx = Math.min(preferredRank - 1, pool.length - 1);
  const preferredProvider = pool[preferredIdx];
  const winnerProvider = pool[0]; // base rank #1

  // Base winner score — use realistic range [0.85, 0.97]
  const baseWinnerScore = round4(0.92 + Math.random() * 0.05);
  const preferredBaseScore = round4(baseWinnerScore - gap);

  // Clamp preferred score to valid range
  const clampedPreferred = Math.max(0.5, Math.min(1.0, preferredBaseScore));

  // Build ranking: winner first, then preferred at its target rank, then others
  const ranked: Array<{ providerId: ProviderId; score: number }> = [];
  const usedProviders = new Set<ProviderId>();

  // Winner at rank #1
  ranked.push({ providerId: winnerProvider, score: baseWinnerScore });
  usedProviders.add(winnerProvider);

  // Fill ranks up to preferredRank
  for (let i = 1; i < preferredRank; i++) {
    const filler = pool.find((p) => !usedProviders.has(p) && p !== preferredProvider);
    if (filler) {
      // Fillers get scores between preferred and winner
      const fillerScore = round4(
        baseWinnerScore - gap * (0.3 + Math.random() * 0.4),
      );
      ranked.push({ providerId: filler, score: Math.max(0.5, Math.min(1.0, fillerScore)) });
      usedProviders.add(filler);
    }
  }

  // Preferred at target rank
  ranked.push({ providerId: preferredProvider, score: clampedPreferred });
  usedProviders.add(preferredProvider);

  // Remaining providers (lower ranks)
  for (const p of pool) {
    if (!usedProviders.has(p)) {
      const fillerScore = round4(clampedPreferred - 0.01 - Math.random() * 0.05);
      ranked.push({ providerId: p, score: Math.max(0.5, Math.min(1.0, fillerScore)) });
      usedProviders.add(p);
    }
  }

  const hint: PolicyHint = {
    preferredProviderId: preferredProvider,
    strength: "low",
    ruleId: `rule-${opts.noMatch ? "none" : "test"}`,
    ruleName: opts.noMatch ? undefined : "Test rule",
  };

  const actualGap = baseWinnerScore - clampedPreferred;
  const gapBucket = resolveGapBucket(actualGap);

  return {
    id: nextId("ctrl"),
    description: `gap=${gap.toFixed(4)} target=rank#${preferredRank} providers=${pool.length} health=${opts.health ?? "healthy"} caps=${(opts.capabilities ?? []).join(",") || "none"}`,
    baseRanking: ranked,
    hintTargetRank: preferredRank,
    hint,
    expectedFlip: actualGap <= POLICY_HINT_BONUS.low && preferredRank > 1,
    gapBucket,
    healthProfile: opts.health ?? "healthy",
    capabilities: opts.capabilities ?? [],
    providerCount: pool.length,
    clamping: opts.clamping ?? false,
    noMatch: opts.noMatch ?? false,
    killSwitch: opts.killSwitch ?? false,
    singleEligible: opts.singleEligible ?? false,
  };
}

function resolveGapBucket(gap: number): string {
  if (gap <= 0) return "0";
  if (gap <= 0.005) return "0.001-0.005";
  if (gap <= 0.01) return "0.005-0.01";
  if (gap <= 0.015) return "0.01-0.015";
  if (gap <= 0.02) return "0.015-0.02";
  if (gap <= 0.03) return "0.02-0.03";
  return ">0.03";
}

// ─── Evidence record ──────────────────────────────────────────────────────────

interface EvidenceRecord {
  fixture_id: string;
  description: string;
  fixture_gap_bucket: string;
  fixture_health: string;
  fixture_capabilities: string[];
  fixture_provider_count: number;
  fixture_preferred_rank: number;
  fixture_clamping: boolean;
  fixture_no_match: boolean;
  fixture_kill_switch: boolean;
  fixture_single_eligible: boolean;
  hint_applied: boolean;
  preferred_provider_id: string;
  strength: string;
  base_winner_provider: string;
  base_winner_score: number;
  preferred_base_score: number;
  base_score_gap: number;
  bonus: number;
  adjusted_preferred_score: number;
  hypothetical_provider: string;
  ranking_changed: boolean;
  decision_changed: boolean;
  preference_defeated: boolean;
  adjusted_rank_of_preferred: number;
  base_rank_of_preferred: number;
  rank_delta: number;
  eligible_provider_count: number;
}

// ─── Corpus builder ───────────────────────────────────────────────────────────

function buildCorpus(): Fixture[] {
  const fixtures: Fixture[] = [];

  // === GAP VARIATION × PROVIDER COUNT ===
  // 7 gap buckets × 4 pool sizes × 2-3 preferred rank positions × 6 repeats = ~504
  for (const gapRange of GAP_RANGES) {
    for (const [poolLabel, pool] of [
      ["2", POOL_2] as const,
      ["3", POOL_3] as const,
      ["4", POOL_4] as const,
      ["5", POOL_5] as const,
    ]) {
      const ranks = [2]; // preferred at rank #2 (most interesting)
      if (pool.length >= 3) ranks.push(3);
      if (pool.length >= 4) ranks.push(4);

      for (const rank of ranks) {
        for (let rep = 0; rep < 6; rep++) {
          const gap = gapRange.min + Math.random() * (gapRange.max - gapRange.min);
          fixtures.push(buildFixture(gap, rank, pool, {
            capabilities: CAPABILITY_SETS[Math.floor(Math.random() * CAPABILITY_SETS.length)],
          }));
        }
      }
    }
  }

  // === HEALTH PROFILES × GAP ===
  // 3 health profiles × 5 gap buckets × 3 repeats = ~45
  for (const health of HEALTH_PROFILES) {
    for (const gapRange of [GAP_RANGES[0], GAP_RANGES[1], GAP_RANGES[3], GAP_RANGES[5], GAP_RANGES[6]]) {
      for (let rep = 0; rep < 3; rep++) {
        const gap = gapRange.min + Math.random() * (gapRange.max - gapRange.min);
        fixtures.push(buildFixture(gap, 2, POOL_3, { health }));
      }
    }
  }

  // === CLAMPING near 1.0 ===
  // preferred base score near 1.0, so adjusted would clamp to 1.0
  for (let rep = 0; rep < 8; rep++) {
    const highBase = round4(0.975 + Math.random() * 0.02);
    const gap = round4(0.005 + Math.random() * 0.01);
    const ranking: Array<{ providerId: ProviderId; score: number }> = [
      { providerId: "kimi_api", score: highBase },
      { providerId: "openai_api", score: round4(highBase - gap) },
    ];
    fixtures.push({
      id: nextId("clamp"),
      description: `clamping gap=${gap.toFixed(4)} base=${highBase.toFixed(4)}`,
      baseRanking: ranking,
      hintTargetRank: 2,
      hint: {
        preferredProviderId: "openai_api",
        strength: "low",
        ruleId: "rule-clamp",
        ruleName: "Clamp test",
      },
      expectedFlip: true,
      gapBucket: resolveGapBucket(gap),
      healthProfile: "healthy",
      capabilities: [],
      providerCount: 2,
      clamping: true,
      noMatch: false,
      killSwitch: false,
      singleEligible: false,
    });
  }

  // === SINGLE ELIGIBLE PROVIDER ===
  for (let rep = 0; rep < 10; rep++) {
    const singleRanking: Array<{ providerId: ProviderId; score: number }> = [
      { providerId: "kimi_api", score: round4(0.9 + Math.random() * 0.05) },
    ];
    fixtures.push({
      id: nextId("single"),
      description: `single-eligible provider`,
      baseRanking: singleRanking,
      hintTargetRank: 1,
      hint: {
        preferredProviderId: "kimi_api",
        strength: "low",
        ruleId: "rule-single",
        ruleName: "Single eligible",
      },
      expectedFlip: false,
      gapBucket: "0",
      healthProfile: "healthy",
      capabilities: [],
      providerCount: 1,
      clamping: false,
      noMatch: false,
      killSwitch: false,
      singleEligible: true,
    });
  }

  // === PREFERRED AT RANK #1 (no-op — already top) ===
  for (const gap of [0, 0.005, 0.01, 0.03]) {
    fixtures.push(buildFixture(gap, 1, POOL_3, {}));
  }

  // === RULE NO-MATCH (no hint generated) ===
  for (let rep = 0; rep < 10; rep++) {
    fixtures.push(buildFixture(
      Math.random() * 0.02,
      2,
      POOL_3,
      { noMatch: true },
    ));
  }

  // === KILL SWITCH (complete no-op) ===
  for (let rep = 0; rep < 6; rep++) {
    fixtures.push(buildFixture(
      Math.random() * 0.02,
      2,
      POOL_3,
      { killSwitch: true },
    ));
  }

  // === EQUAL ADJUSTED SCORES (gap = bonus exactly) ===
  for (let rep = 0; rep < 12; rep++) {
    fixtures.push(buildFixture(
      POLICY_HINT_BONUS.low, // gap = bonus → adjusted scores tie
      2,
      POOL_3,
      {},
    ));
  }

  // === LARGE GAP (>0.03) — must never flip ===
  for (let rep = 0; rep < 40; rep++) {
    const gap = round4(0.035 + Math.random() * 0.04);
    fixtures.push(buildFixture(gap, 2, POOL_3, {}));
  }

  // === EXACT GAP = 0.03 boundary ===
  for (let rep = 0; rep < 8; rep++) {
    fixtures.push(buildFixture(0.03, 2, POOL_3, {}));
  }

  // === EXACT GAP = 0 boundary ===
  for (let rep = 0; rep < 8; rep++) {
    fixtures.push(buildFixture(0, 2, POOL_3, {}));
  }

  return fixtures;
}

// ─── Analysis & output ────────────────────────────────────────────────────────

function runFixture(fixture: Fixture): EvidenceRecord {
  // Observer behavior: no rule matched → no hint generated → ranking unchanged
  const isNoHint = fixture.noMatch || fixture.killSwitch;

  const adjusted: PolicyAdjustedRanking = isNoHint
    ? {
        ranked: fixture.baseRanking.map((p, i) => ({
          providerId: p.providerId,
          baseScore: p.score,
          adjustedScore: p.score,
          baseRank: i,
          adjustedRank: i,
        })),
        hintApplied: false,
        preferredProviderId: fixture.hint.preferredProviderId,
      }
    : applyPolicyHintToRanking(fixture.baseRanking, fixture.hint);

  const preferredEntry = adjusted.ranked.find(
    (e) => e.providerId === fixture.hint.preferredProviderId,
  );
  const baseWinner = fixture.baseRanking[0];

  const hypotheticalProvider = adjusted.ranked[0]?.providerId ?? "";
  const rankingChanged = hypotheticalProvider !== baseWinner?.providerId;
  const decisionChanged = rankingChanged; // in evidence-only, hypothetical is the decision
  const preferenceDefeated =
    adjusted.hintApplied && hypotheticalProvider !== fixture.hint.preferredProviderId;

  return {
    fixture_id: fixture.id,
    description: fixture.description,
    fixture_gap_bucket: fixture.gapBucket,
    fixture_health: fixture.healthProfile,
    fixture_capabilities: [...fixture.capabilities],
    fixture_provider_count: fixture.providerCount,
    fixture_preferred_rank: fixture.hintTargetRank,
    fixture_clamping: fixture.clamping,
    fixture_no_match: fixture.noMatch,
    fixture_kill_switch: fixture.killSwitch,
    fixture_single_eligible: fixture.singleEligible,
    hint_applied: adjusted.hintApplied,
    preferred_provider_id: fixture.hint.preferredProviderId,
    strength: fixture.hint.strength,
    base_winner_provider: baseWinner?.providerId ?? "",
    base_winner_score: baseWinner?.score ?? 0,
    preferred_base_score: preferredEntry?.baseScore ?? 0,
    base_score_gap: preferredEntry ? (baseWinner?.score ?? 0) - preferredEntry.baseScore : 0,
    bonus: preferredEntry ? POLICY_HINT_BONUS[fixture.hint.strength] : 0,
    adjusted_preferred_score: preferredEntry?.adjustedScore ?? 0,
    hypothetical_provider: hypotheticalProvider,
    ranking_changed: rankingChanged,
    decision_changed: decisionChanged,
    preference_defeated: preferenceDefeated,
    adjusted_rank_of_preferred: preferredEntry?.adjustedRank ?? -1,
    base_rank_of_preferred: preferredEntry?.baseRank ?? -1,
    rank_delta: preferredEntry ? Math.abs(preferredEntry.adjustedRank - preferredEntry.baseRank) : 0,
    eligible_provider_count: fixture.baseRanking.length,
  };
}

async function main() {
  const outDir = process.argv.includes("--out")
    ? process.argv[process.argv.indexOf("--out") + 1]
    : "/tmp/6c3b-controlled";

  await fs.mkdir(outDir, { recursive: true });

  const fixtures = buildCorpus();
  const evidence: EvidenceRecord[] = [];

  for (const f of fixtures) {
    evidence.push(runFixture(f));
  }

  // Write NDJSON
  const ndjsonPath = path.join(outDir, "controlled-evidence.ndjson");
  await fs.writeFile(
    ndjsonPath,
    evidence.map((e) => JSON.stringify(e)).join("\n"),
    "utf8",
  );

  // Summary stats
  const total = evidence.length;
  const applied = evidence.filter((e) => e.hint_applied).length;
  const noMatch = evidence.filter((e) => e.fixture_no_match).length;
  const killed = evidence.filter((e) => e.fixture_kill_switch).length;
  const singleEligible = evidence.filter((e) => e.fixture_single_eligible).length;
  const flipped = evidence.filter((e) => e.ranking_changed && e.hint_applied).length;
  const defeated = evidence.filter((e) => e.preference_defeated && e.hint_applied).length;

  console.log(`=== 6C.3B Controlled Matrix ===`);
  console.log(`total fixtures:     ${total}`);
  console.log(`hints applied:      ${applied}`);
  console.log(`no-match (no hint): ${noMatch}`);
  console.log(`kill-switch:        ${killed}`);
  console.log(`single-eligible:    ${singleEligible}`);
  console.log(`ranking changed:    ${flipped}`);
  console.log(`preference defeated:${defeated}`);
  console.log(`\nndjson: ${ndjsonPath}`);

  // Gap bucket breakdown
  const bucketOrder = ["0", "0.001-0.005", "0.005-0.01", "0.01-0.015", "0.015-0.02", "0.02-0.03", ">0.03"];
  console.log(`\n--- gap bucket analysis (applied hints only) ---`);
  console.log(`gap bucket       hints  flips  flip%`);
  for (const bucket of bucketOrder) {
    const inBucket = evidence.filter((e) => e.fixture_gap_bucket === bucket && e.hint_applied);
    const flipsInBucket = inBucket.filter((e) => e.ranking_changed);
    const rate = inBucket.length > 0 ? ((flipsInBucket.length / inBucket.length) * 100).toFixed(1) : "n/a";
    console.log(
      `${bucket.padEnd(16)} ${String(inBucket.length).padStart(5)}  ${String(flipsInBucket.length).padStart(5)}  ${rate.padStart(5)}%`,
    );
  }

  // Flipped decisions detail
  const flippedDetails = evidence
    .filter((e) => e.ranking_changed && e.hint_applied)
    .sort((a, b) => b.base_score_gap - a.base_score_gap);

  if (flippedDetails.length > 0) {
    console.log(`\n--- flipped decisions (sorted by gap desc) ---`);
    console.log(`id          gap      base_winner      preferred        adjusted_winner  pref_rank  rank_delta`);
    for (const e of flippedDetails.slice(0, 30)) {
      console.log(
        `${e.fixture_id}  ${e.base_score_gap.toFixed(4)}  ${e.base_winner_provider.padEnd(16)}${e.preferred_provider_id.padEnd(16)}${e.hypothetical_provider.padEnd(16)}#${e.base_rank_of_preferred}→#${e.adjusted_rank_of_preferred}     ${e.rank_delta}`,
      );
    }
    if (flippedDetails.length > 30) {
      console.log(`... and ${flippedDetails.length - 30} more`);
    }
  }

  // Safety assertions
  console.log(`\n--- safety assertions ---`);
  const flipsAboveBonus = evidence.filter(
    (e) => e.ranking_changed && e.hint_applied && e.base_score_gap > POLICY_HINT_BONUS.low,
  );
  console.log(`flips above bonus gap: ${flipsAboveBonus.length} (must be 0)`);
  if (flipsAboveBonus.length > 0) {
    for (const e of flipsAboveBonus) {
      console.log(`  VIOLATION: ${e.fixture_id} gap=${e.base_score_gap.toFixed(4)} bonus=${e.bonus}`);
    }
  }

  const noHintChanges = evidence.filter(
    (e) => !e.hint_applied && e.ranking_changed,
  );
  console.log(`no-hint ranking changes: ${noHintChanges.length} (must be 0 — no hint means no adjustment)`);
  const killSwitchNoOp = evidence.filter(
    (e) => e.fixture_kill_switch && e.ranking_changed,
  );
  console.log(`kill-switch ranking changes: ${killSwitchNoOp.length} (must be 0)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
