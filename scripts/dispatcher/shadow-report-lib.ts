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
  };
}

const pct = (v: number) => `${v.toFixed(2)}%`;

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
    report.errorEvents.length
      ? `shadow evaluation errors:\n${report.errorEvents.map((e) => `  ${e}`).join("\n")}`
      : "shadow evaluation errors: none",
  ];
  return lines.join("\n");
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
    report.errorEvents.length
      ? [`## Shadow evaluation errors`, ``, ...report.errorEvents.map((e) => `- ${e}`), ``].join("\n")
      : "",
  ];
  return lines.join("\n");
}