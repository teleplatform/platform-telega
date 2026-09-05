import { GovernanceOutcome, OutcomeKind, OutcomeSource, OutcomeSeverity, OutcomeQuery } from "./governanceTypes";

const outcomes: GovernanceOutcome[] = [];

let counter = 0;
function genId(): string {
  counter++;
  return `gov_out_${Date.now()}_${counter}`;
}

export const GovernanceRegistry = {
  record(
    kind: OutcomeKind,
    source: OutcomeSource,
    severity: OutcomeSeverity,
    summary: string,
    details: Record<string, unknown>,
    evidenceRefs: string[]
  ): GovernanceOutcome {
    const outcome: GovernanceOutcome = {
      outcomeId: genId(),
      kind,
      source,
      severity,
      summary,
      details,
      evidenceRefs,
      trusted: evidenceRefs.length > 0,
      timestamp: Date.now(),
    };
    outcomes.push(outcome);
    return outcome;
  },

  get(id: string): GovernanceOutcome | undefined {
    return outcomes.find((o) => o.outcomeId === id);
  },

  getAll(): GovernanceOutcome[] {
    return [...outcomes];
  },

  query(q: OutcomeQuery): GovernanceOutcome[] {
    return outcomes.filter((o) => {
      if (q.kinds && !q.kinds.includes(o.kind)) return false;
      if (q.sources && !q.sources.includes(o.source)) return false;
      if (q.severities && !q.severities.includes(o.severity)) return false;
      if (q.trusted !== undefined && o.trusted !== q.trusted) return false;
      if (q.since && o.timestamp < q.since) return false;
      if (q.until && o.timestamp > q.until) return false;
      return true;
    }).slice(0, q.limit || 100);
  },

  linkEvidence(outcomeId: string, evidenceRef: string): GovernanceOutcome | null {
    const idx = outcomes.findIndex((o) => o.outcomeId === outcomeId);
    if (idx === -1) return null;
    const outcome = outcomes[idx];
    if (!outcome.evidenceRefs.includes(evidenceRef)) {
      outcome.evidenceRefs.push(evidenceRef);
      outcome.trusted = outcome.evidenceRefs.length > 0;
    }
    return outcome;
  },

  size(): number {
    return outcomes.length;
  },
};
