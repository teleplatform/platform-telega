import type { RuntimeWorker } from './worker-types.js';
import type { RuntimeCapability, TaskType } from '../sigma-forge/sigma-forge-types.js';
import { getOnlineWorkers } from './worker-registry.js';
import { computeScore, rankWorkersForCapability } from './worker-score-engine.js';
import { getQualityProfile } from './capability-quality-profile.js';

export type SelectionPolicy = 'least-loaded' | 'best-score' | 'weighted-composite' | 'round-robin';

let currentPolicy: SelectionPolicy = 'weighted-composite';
let roundRobinIndex = new Map<string, number>();

export function setSelectionPolicy(policy: SelectionPolicy): void {
  currentPolicy = policy;
}

export function getSelectionPolicy(): SelectionPolicy {
  return currentPolicy;
}

export function selectWorker(taskType: TaskType, capability: RuntimeCapability): RuntimeWorker | undefined {
  const candidates = getOnlineWorkers().filter(w =>
    w.capabilities.some(c => c.taskTypes.includes(taskType))
  );

  if (candidates.length === 0) return undefined;

  switch (currentPolicy) {
    case 'least-loaded':
      return selectLeastLoaded(candidates);
    case 'best-score':
      return selectBestScore(candidates, capability);
    case 'weighted-composite':
      return selectWeightedComposite(candidates, capability);
    case 'round-robin':
      return selectRoundRobin(candidates, capability);
    default:
      return selectWeightedComposite(candidates, capability);
  }
}

function selectLeastLoaded(candidates: RuntimeWorker[]): RuntimeWorker {
  return candidates.reduce((best, current) => {
    const bestLoad = best.assignedTaskIds.length / best.capabilities.reduce((s, c) => s + c.maxConcurrency, 0);
    const currentLoad = current.assignedTaskIds.length / current.capabilities.reduce((s, c) => s + c.maxConcurrency, 0);
    return currentLoad < bestLoad ? current : best;
  });
}

function selectBestScore(candidates: RuntimeWorker[], capability: RuntimeCapability): RuntimeWorker {
  const ranked = rankWorkersForCapability(candidates.map(w => w.id), capability);
  if (ranked.length === 0) return candidates[0];
  const bestId = ranked[0].workerId;
  return candidates.find(w => w.id === bestId) ?? candidates[0];
}

function selectWeightedComposite(candidates: RuntimeWorker[], capability: RuntimeCapability): RuntimeWorker {
  const ranked = rankWorkersForCapability(candidates.map(w => w.id), capability);

  // Blend score with load: finalScore = score * (1 - loadPenalty)
  const scored = ranked.map(score => {
    const worker = candidates.find(w => w.id === score.workerId);
    if (!worker) return { worker: null, finalScore: 0 };

    const loadRatio = worker.assignedTaskIds.length / Math.max(1, worker.capabilities.reduce((s, c) => s + c.maxConcurrency, 0));
    const loadPenalty = loadRatio * 20; // up to 20 point penalty
    const finalScore = score.compositeScore - loadPenalty;

    return { worker, finalScore };
  });

  const best = scored.filter(s => s.worker).sort((a, b) => b.finalScore - a.finalScore)[0];
  return best?.worker ?? candidates[0];
}

function selectRoundRobin(candidates: RuntimeWorker[], capability: RuntimeCapability): RuntimeWorker {
  const key = `rr:${capability}`;
  const idx = roundRobinIndex.get(key) ?? 0;
  const selected = candidates[idx % candidates.length];
  roundRobinIndex.set(key, idx + 1);
  return selected;
}

export function resetRoundRobin(): void {
  roundRobinIndex.clear();
}
