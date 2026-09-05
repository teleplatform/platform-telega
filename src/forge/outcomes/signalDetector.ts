import { LearningSignal, SignalCategory } from "./outcomeTypes";
import { OutcomeRegistry } from "./outcomeRegistry";

const signals: LearningSignal[] = [];

let counter = 0;
function genId(prefix: string): string {
  counter++;
  return `${prefix}_${Date.now()}_${counter}`;
}

function detectAgentSignals(): LearningSignal[] {
  const result: LearningSignal[] = [];

  // Agent performance by role
  const agentRoles = ["planner", "coder", "tester", "verifier", "researcher", "designer"];
  for (const role of agentRoles) {
    const outcomes = OutcomeRegistry.getByAgent(role);
    if (outcomes.length < 3) continue;

    const successes = outcomes.filter((o) => o.success).length;
    const rate = Math.round((successes / outcomes.length) * 100);

    if (rate < 60) {
      result.push({
        signalId: genId("sig"),
        category: "agent_performance",
        description: `Agent role "${role}" has low success rate: ${rate}% (${successes}/${outcomes.length})`,
        confidence: Math.round((1 - rate / 100) * 100),
        evidenceRefs: outcomes.slice(0, 5).map((o) => o.outcomeId),
        metricValue: rate,
        threshold: 60,
        createdAt: Date.now(),
      });
    }
  }

  return result;
}

function detectProviderSignals(): LearningSignal[] {
  const result: LearningSignal[] = [];
  const providers = [...new Set(OutcomeRegistry.getAll().map((o) => o.providerUsed))];

  for (const provider of providers) {
    const outcomes = OutcomeRegistry.getByProvider(provider);
    if (outcomes.length < 3) continue;

    const avgDuration = Math.round(outcomes.reduce((s, o) => s + o.durationMs, 0) / outcomes.length);
    const successes = outcomes.filter((o) => o.success).length;
    const rate = Math.round((successes / outcomes.length) * 100);

    if (avgDuration > 300000 || rate < 50) {
      result.push({
        signalId: genId("sig"),
        category: "provider_performance",
        description: `Provider "${provider}" — success ${rate}%, avg ${Math.round(avgDuration / 1000)}s`,
        confidence: Math.round(outcomes.length > 10 ? 80 : 50),
        evidenceRefs: outcomes.slice(0, 5).map((o) => o.outcomeId),
        metricValue: avgDuration,
        threshold: 300000,
        createdAt: Date.now(),
      });
    }
  }

  return result;
}

function detectRepairSignals(): LearningSignal[] {
  const result: LearningSignal[] = [];
  const outcomes = OutcomeRegistry.getAll();
  if (outcomes.length < 3) return result;

  const totalRepairs = outcomes.reduce((s, o) => s + o.repairsTriggered, 0);
  const totalRollbacks = outcomes.reduce((s, o) => s + o.rollbacksUsed, 0);

  if (totalRepairs > 0) {
    const rollbackRate = totalRollbacks > 0 ? Math.round((totalRollbacks / totalRepairs) * 100) : 0;
    result.push({
      signalId: genId("sig"),
      category: "repair_performance",
      description: `Repair: ${totalRepairs} total, ${rollbackRate}% rollback rate`,
      confidence: Math.min(90, totalRepairs * 10),
      evidenceRefs: outcomes.slice(0, 5).map((o) => o.outcomeId),
      metricValue: rollbackRate,
      threshold: 30,
      createdAt: Date.now(),
    });
  }

  return result;
}

export function detectSignals(): LearningSignal[] {
  const newSignals = [
    ...detectAgentSignals(),
    ...detectProviderSignals(),
    ...detectRepairSignals(),
  ];

  signals.push(...newSignals);
  return newSignals;
}

export function getAllSignals(): LearningSignal[] {
  return [...signals];
}

export function getSignalsByCategory(category: SignalCategory): LearningSignal[] {
  return signals.filter((s) => s.category === category);
}
