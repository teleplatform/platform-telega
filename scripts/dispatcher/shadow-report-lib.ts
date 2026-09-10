/**
 * Dispatcher SHADOW observation — divergence report aggregation.
 *
 * Pure helpers shared by:
 *   - scripts/dispatcher/shadow-observation-run.ts  (controlled replay)
 *   - scripts/dispatcher/shadow-divergence-report.ts (live audit trail)
 *
 * Input are `routing.dispatcher.*` AuditEvents emitted by the 6C.1 shadow
 * observer. Output is a non-sensitive divergence report: only provider/model
 * ids, rule ids, request ids and counts — never prompts, secrets or user
 * content.
 */

import type { AuditEvent } from "../../src/runtime/audit/audit-types.js";

export type DivergenceKind =
  | "agree"
  | "different_target"
  | "no_match"
  | "both_reject";

export interface ShadowDecisionRecord {
  requestId: string;
  decisionId?: string;
  mode: string;
  actualProvider?: string;
  actualModel?: string;
  dispatcherOutcome: "matched" | "no_match";
  winnerRuleId?: string;
  routeTo?: string;
  fallback?: string;
  diverged: boolean;
  divergenceKind?: DivergenceKind;
  matchedRuleCount: number;
  input?: Record<string, unknown>;
}

export interface DivergenceReport {
  generatedAt: string;
  sourceLabel: string;
  totals: {
    decisions: number;
    agree: number;
    differentTarget: number;
    noMatch: number;
    bothReject: number;
    errors: number;
    unobservedSelections: number;
  };
  rates: {
    agreeRate: number;
    differentTargetRate: number;
    noMatchRate: number;
    bothRejectRate: number;
    errorRate: number;
  };
  matchedRuleBreakdown: Array<{ ruleId: string; ruleName?: string; count: number }>;
  divergent: ShadowDecisionRecord[];
  errorEvents: string[];
  policy: PolicyStats;
}

/**
 * Phase 6C.3A — hypothetical soft-policy influence metrics. Replaces
 * convergence as the principal validation signal: measures whether the
 * approved bounded hint WOULD have changed the executable provider choice
 * using the exact base ranking production actually used.
 */
export interface PolicyStats {
  hintsGenerated: number;
  hintsEligible: number;
  hintsIneligible: number;
  decisionImpacted: number;
  targetWins: number;
  preferenceDefeated: number;
  decisionImpactRate: number;
  hintTargetWinRate: number;
  preferenceDefeatedRate: number;
  averageRankDelta: number;
  maxRankDelta: number;
  averageBaseScoreGap: number;
  averageFlippedScoreGap: number;
  maxFlippedScoreGap: number;
  averagePolicyBonus: number;
  maxPolicyBonus: number;
}

export function emptyPolicyStats(): PolicyStats {
  return {
    hintsGenerated: 0,
    hintsEligible: 0,
    hintsIneligible: 0,
    decisionImpacted: 0,
    targetWins: 0,
    preferenceDefeated: 0,
    decisionImpactRate: 0,
    hintTargetWinRate: 0,
    preferenceDefeatedRate: 0,
    averageRankDelta: 0,
    maxRankDelta: 0,
    averageBaseScoreGap: 0,
    averageFlippedScoreGap: 0,
    maxFlippedScoreGap: 0,
    averagePolicyBonus: 0,
    maxPolicyBonus: 0,
  };
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function buildPolicyStats(events: AuditEvent[]): PolicyStats {
  const stats = emptyPolicyStats();
  const rankDeltas: number[] = [];
  const baseScoreGaps: number[] = [];
  const flippedScoreGaps: number[] = [];
  const bonuses: number[] = [];

  for (const event of events) {
    if (event.kind !== "routing.dispatcher.shadow_decision") continue;
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const policy = payload.policy as Record<string, unknown> | null | undefined;
    if (!policy) continue;

    stats.hintsGenerated += 1;
    const hitApplied = policy.hint_applied === true;
    const adjustedRank = num(policy.adjusted_rank);
    const baseRank = num(policy.base_rank);
    const gap = num(policy.base_score_gap);
    const changed = policy.decision_changed === true;
    const rankingChanged = policy.ranking_changed === true;
    const defeated = policy.preference_defeated === true;
    const bonus = num(policy.policy_bonus);

    if (!hitApplied) {
      stats.hintsIneligible += 1;
      continue;
    }
    stats.hintsEligible += 1;

    if (bonus !== null) {
      bonuses.push(bonus);
      stats.maxPolicyBonus = Math.max(stats.maxPolicyBonus, bonus);
    }
    if (baseRank !== null && adjustedRank !== null) {
      rankDeltas.push(Math.abs(adjustedRank - baseRank));
      stats.maxRankDelta = Math.max(stats.maxRankDelta, Math.abs(adjustedRank - baseRank));
    }
    if (gap !== null) {
      baseScoreGaps.push(gap);
    }
    if (rankingChanged && gap !== null) {
      flippedScoreGaps.push(gap);
      stats.maxFlippedScoreGap = Math.max(stats.maxFlippedScoreGap, gap);
    }
    if (changed) {
      stats.decisionImpacted += 1;
    }
    if (defeated) {
      stats.preferenceDefeated += 1;
    } else {
      stats.targetWins += 1;
    }
  }

  const mean = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  stats.averageRankDelta = mean(rankDeltas);
  stats.averageBaseScoreGap = mean(baseScoreGaps);
  stats.averageFlippedScoreGap = mean(flippedScoreGaps);
  stats.averagePolicyBonus = mean(bonuses);
  stats.decisionImpactRate =
    stats.hintsEligible > 0 ? (stats.decisionImpacted / stats.hintsEligible) * 100 : 0;
  stats.hintTargetWinRate =
    stats.hintsEligible > 0 ? (stats.targetWins / stats.hintsEligible) * 100 : 0;
  stats.preferenceDefeatedRate =
    stats.hintsEligible > 0 ? (stats.preferenceDefeated / stats.hintsEligible) * 100 : 0;
  return stats;
}

export function parseShadowDecision(
  payload: Record<string, unknown>,
  traceId?: string,
): ShadowDecisionRecord | null {
  const dispatcher = (payload.dispatcher ?? {}) as Record<string, unknown>;
  const actual = (payload.actual ?? {}) as Record<string, unknown>;
  const divergence = (payload.divergence ?? {}) as Record<string, unknown>;

  return {
    requestId: (payload.request_id as string) ?? traceId ?? String(payload.trace_id ?? "?"),
    decisionId: (payload.decision_id as string) ?? undefined,
    mode: (payload.mode as string) ?? "shadow",
    actualProvider: actual.provider_id as string | undefined,
    actualModel: actual.model_id as string | undefined,
    dispatcherOutcome: dispatcher.outcome === "no_match" ? "no_match" : "matched",
    winnerRuleId: dispatcher.winner_rule_id as string | undefined,
    routeTo: dispatcher.route_to as string | undefined,
    fallback: dispatcher.fallback as string | undefined,
    diverged: (payload.converged as boolean) === false,
    divergenceKind: (divergence.kind as DivergenceKind) ?? (payload.converged ? "agree" : "different_target"),
    matchedRuleCount: (dispatcher.matched_rule_count as number) ?? 0,
    input: (payload.input as Record<string, unknown>) ?? undefined,
  };
}

export function buildDivergenceReport(
  events: AuditEvent[],
  opts: { sourceLabel: string; unobservedSelections?: number },
): DivergenceReport {
  const decisions: ShadowDecisionRecord[] = [];
  const errorEvents: string[] = [];

  for (const event of events) {
    if (event.kind === "routing.dispatcher.shadow_decision") {
      const record = parseShadowDecision(event.payload ?? {}, event.traceId);
      if (record) decisions.push(record);
    } else if (event.kind === "routing.dispatcher.error") {
      errorEvents.push(
        `[${event.traceId}] ${String((event.payload as Record<string, unknown>)?.error ?? "unknown")}`,
      );
    }
  }

  const totals = {
    decisions: decisions.length,
    agree: decisions.filter((d) => !d.diverged && d.dispatcherOutcome === "matched").length,
    differentTarget: decisions.filter((d) => d.divergenceKind === "different_target").length,
    noMatch: decisions.filter((d) => d.divergenceKind === "no_match").length,
    bothReject: decisions.filter((d) => d.divergenceKind === "both_reject").length,
    errors: errorEvents.length,
    unobservedSelections: opts.unobservedSelections ?? 0,
  };

  const rate = (n: number) => (totals.decisions > 0 ? (n / totals.decisions) * 100 : 0);
  const rates = {
    agreeRate: rate(totals.agree),
    differentTargetRate: rate(totals.differentTarget),
    noMatchRate: rate(totals.noMatch),
    bothRejectRate: rate(totals.bothReject),
    errorRate: rate(totals.errors),
  };

  const byRule = new Map<string, number>();
  for (const d of decisions) {
    if (d.winnerRuleId) byRule.set(d.winnerRuleId, (byRule.get(d.winnerRuleId) ?? 0) + 1);
  }
  const matchedRuleBreakdown = [...byRule.entries()]
    .map(([ruleId, count]) => ({ ruleId, count }))
    .sort((a, b) => b.count - a.count);

  const divergent = decisions.filter((d) => d.diverged || d.dispatcherOutcome === "no_match");

  return {
    generatedAt: new Date().toISOString(),
    sourceLabel: opts.sourceLabel,
    totals,
    rates,
    matchedRuleBreakdown,
    divergent,
    errorEvents,
    policy: buildPolicyStats(events),
  };
}

const pct = (v: number) => `${v.toFixed(2)}%`;

function formatPolicyAscii(p: PolicyStats): string[] {
  if (p.hintsGenerated === 0) {
    return [`policy influence (6C.3A): no hints generated`];
  }
  return [
    `policy influence (6C.3A):`,
    `  ${String(p.hintsGenerated).padStart(6)} hints generated     (winner rule matched)`,
    `  ${String(p.hintsEligible).padStart(6)} hints eligible      (target present in base ranking)`,
    `  ${String(p.hintsIneligible).padStart(6)} hints ineligible    (target absent)`,
    `  ${String(p.decisionImpacted).padStart(6)} decisions impacted  ${pct(p.decisionImpactRate)}`,
    `  ${String(p.targetWins).padStart(6)} hint targets won     ${pct(p.hintTargetWinRate)}`,
    `  ${String(p.preferenceDefeated).padStart(6)} preference defeated ${pct(p.preferenceDefeatedRate)}`,
    `  avg/max rank delta: ${p.averageRankDelta.toFixed(3)} / ${p.maxRankDelta.toFixed(3)}`,
    `  avg base score gap: ${p.averageBaseScoreGap.toFixed(4)}`,
    `  avg/max flipped gap: ${p.averageFlippedScoreGap.toFixed(4)} / ${p.maxFlippedScoreGap.toFixed(4)}`,
    `  avg/max policy bonus: ${p.averagePolicyBonus.toFixed(4)} / ${p.maxPolicyBonus.toFixed(4)}`,
  ];
}

export function formatAsciiSummary(report: DivergenceReport): string {
  const t = report.totals;
  const r = report.rates;
  const lines = [
    `SHADOW DIVERGENCE REPORT (${report.sourceLabel})`,
    `generated at ${report.generatedAt}`,
    ``,
    `${t.decisions} decisions`,
    `  ${t.agree.toLocaleString().padStart(6)} agree            ${pct(r.agreeRate)}`,
    `  ${t.differentTarget.toLocaleString().padStart(6)} different       ${pct(r.differentTargetRate)}`,
    `  ${t.noMatch.toLocaleString().padStart(6)} no_match         ${pct(r.noMatchRate)}`,
    `  ${t.bothReject.toLocaleString().padStart(6)} both_reject      ${pct(r.bothRejectRate)}`,
    `  ${t.errors.toLocaleString().padStart(6)} errors           ${pct(r.errorRate)}`,
    `  ${t.unobservedSelections.toLocaleString().padStart(6)} unobserved (terminal selection)`,
    ``,
    `matched rule breakdown:`,
    ...(report.matchedRuleBreakdown.length
      ? report.matchedRuleBreakdown.map((r) => `  ${r.ruleId.padEnd(24)} ${r.count}`)
      : ["  (none)"]),
    ``,
    ...formatPolicyAscii(report.policy),
    ``,
    report.errorEvents.length
      ? `shadow evaluation errors:\n${report.errorEvents.map((e) => `  ${e}`).join("\n")}`
      : "shadow evaluation errors: none",
  ];
  return lines.join("\n");
}

function formatPolicyMarkdown(p: PolicyStats): string[] {
  if (p.hintsGenerated === 0) {
    return [`## Policy influence (6C.3A)`, ``, `_No hints generated across this window._`, ``];
  }
  return [
    `## Policy influence (6C.3A) — hypothetical soft-policy ranking`,
    ``,
    `> Computed against the EXACT base ranking production used for actual`,
    `> selection. No second scoring pass. Evidence-only.`,
    ``,
    `| metric | value |`,
    `|---|---:|`,
    `| hints generated | ${p.hintsGenerated} |`,
    `| hints eligible | ${p.hintsEligible} |`,
    `| hints ineligible | ${p.hintsIneligible} |`,
    `| decisions impacted | ${p.decisionImpacted} (${pct(p.decisionImpactRate)}) |`,
    `| hint-target win rate | ${p.hintTargetWinRate}% |`,
    `| preference defeated rate | ${p.preferenceDefeatedRate}% |`,
    `| average rank delta | ${p.averageRankDelta.toFixed(3)} |`,
    `| max rank delta | ${p.maxRankDelta.toFixed(3)} |`,
    `| average base score gap | ${p.averageBaseScoreGap.toFixed(4)} |`,
    `| average flipped score gap | ${p.averageFlippedScoreGap.toFixed(4)} |`,
    `| max flipped score gap | ${p.maxFlippedScoreGap.toFixed(4)} |`,
    `| average policy bonus | ${p.averagePolicyBonus.toFixed(4)} |`,
    `| max policy bonus | ${p.maxPolicyBonus.toFixed(4)} |`,
    ``,
    `> A low hint-target win rate and non-zero preference-defeated rate are the`,
    `> CORRECT outcome: the hint is bounded and production health facts can still`,
    `> defeat it.`,
    ``,
  ];
}

export function formatMarkdownReport(report: DivergenceReport): string {
  const t = report.totals;
  const r = report.rates;
  const lines: string[] = [
    `# Dispatcher SHADOW Observation Window — Divergence Report`,
    ``,
    `> Generated ${report.generatedAt} — source: ${report.sourceLabel}`,
    `> Non-sensitive routing telemetry. No prompts, secrets, API keys or user content.`,
    ``,
    `## Summary`,
    ``,
    `| metric | count | rate |`,
    `|---|---:|---:|`,
    `| decisions | ${t.decisions} | — |`,
    `| agree | ${t.agree} | ${pct(r.agreeRate)} |`,
    `| different_target | ${t.differentTarget} | ${pct(r.differentTargetRate)} |`,
    `| no_match | ${t.noMatch} | ${pct(r.noMatchRate)} |`,
    `| both_reject | ${t.bothReject} | ${pct(r.bothRejectRate)} |`,
    `| shadow evaluation errors | ${t.errors} | ${pct(r.errorRate)} |`,
    `| unobserved (terminal selection, no plan) | ${t.unobservedSelections} | — |`,
    ``,
    `## Matched rule breakdown`,
    ``,
    `| rule id | matched count |`,
    `|---|---:|`,
    ...(report.matchedRuleBreakdown.length
      ? report.matchedRuleBreakdown.map((m) => `| ${m.ruleId} | ${m.count} |`)
      : ["| _(no rule matched across window)_ | 0 |"]),
    ``,
    `## Divergent decisions`,
    ``,
    report.divergent.length
      ? [
          `| request | divergence | actual provider | actual model | dispatcher outcome | winner rule | dispatcher target |`,
          `|---|---|---|---|---|---|---|`,
          ...report.divergent.map(
            (d) =>
              `| ${d.requestId} | ${d.divergenceKind ?? "?"} | ${d.actualProvider ?? "—"} | ${d.actualModel ?? "—"} | ${d.dispatcherOutcome} | ${d.winnerRuleId ?? "—"} | ${d.routeTo ?? "—"} |`,
          ),
        ].join("\n")
      : "_No divergent decisions in this window._",
    ``,
    ...formatPolicyMarkdown(report.policy),
    report.errorEvents.length
      ? [`## Shadow evaluation errors`, ``, ...report.errorEvents.map((e) => `- ${e}`), ``].join("\n")
      : "",
  ];
  return lines.join("\n");
}