import { Outcome } from "./outcomeTypes";

const outcomes: Outcome[] = [];

let counter = 0;
function genId(prefix: string): string {
  counter++;
  return `${prefix}_${Date.now()}_${counter}`;
}

export const OutcomeRegistry = {
  record(
    missionId: string,
    graphId: string,
    success: boolean,
    durationMs: number,
    agentRoles: string[],
    providerUsed: string,
    repairsTriggered: number,
    rollbacksUsed: number,
    evidenceRefs: string[]
  ): Outcome {
    const outcome: Outcome = {
      outcomeId: genId("out"),
      missionId,
      graphId,
      success,
      durationMs,
      agentRoles,
      providerUsed,
      repairsTriggered,
      rollbacksUsed,
      evidenceRefs,
      createdAt: Date.now(),
    };
    outcomes.push(outcome);
    return outcome;
  },

  getAll(): Outcome[] {
    return [...outcomes];
  },

  getByMission(missionId: string): Outcome[] {
    return outcomes.filter((o) => o.missionId === missionId);
  },

  getByProvider(provider: string): Outcome[] {
    return outcomes.filter((o) => o.providerUsed === provider);
  },

  getByAgent(agentRole: string): Outcome[] {
    return outcomes.filter((o) => o.agentRoles.includes(agentRole));
  },

  getSummary(): {
    totalOutcomes: number;
    successRate: number;
    avgDurationMs: number;
    totalRepairs: number;
    totalRollbacks: number;
  } {
    if (outcomes.length === 0) return { totalOutcomes: 0, successRate: 0, avgDurationMs: 0, totalRepairs: 0, totalRollbacks: 0 };

    const successes = outcomes.filter((o) => o.success).length;
    const totalDuration = outcomes.reduce((s, o) => s + o.durationMs, 0);
    const totalRepairs = outcomes.reduce((s, o) => s + o.repairsTriggered, 0);
    const totalRollbacks = outcomes.reduce((s, o) => s + o.rollbacksUsed, 0);

    return {
      totalOutcomes: outcomes.length,
      successRate: Math.round((successes / outcomes.length) * 100),
      avgDurationMs: Math.round(totalDuration / outcomes.length),
      totalRepairs,
      totalRollbacks,
    };
  },

  size(): number {
    return outcomes.length;
  },
};
