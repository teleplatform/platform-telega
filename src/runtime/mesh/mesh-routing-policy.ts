export type RoutingPolicy =
  | 'least-load'
  | 'round-robin'
  | 'prefer-local'
  | 'prefer-remote'
  | 'highest-capacity'
  | 'lowest-latency'
  | 'balanced';

export interface PolicyConfig {
  policy: RoutingPolicy;
  maxRetries?: number;
  timeoutMs?: number;
  fallbackPolicy?: RoutingPolicy;
}

export const DEFAULT_POLICY: PolicyConfig = {
  policy: 'balanced',
  maxRetries: 3,
  timeoutMs: 30000,
  fallbackPolicy: 'prefer-local',
};

export function evaluatePolicy(policy: RoutingPolicy, context: {
  load: number;
  capacity: number;
  isLocal: boolean;
  latencyMs: number;
  healthScore: number;
  nodeCount: number;
}): { selected: boolean; reason: string; score: number } {
  let score = 0;
  let reason = '';

  switch (policy) {
    case 'least-load':
      score = capacity > 0 ? 1 - (load / capacity) : 0;
      reason = 'least loaded node selected';
      break;

    case 'round-robin':
      score = 50;
      reason = 'round-robin distribution';
      break;

    case 'prefer-local':
      score = isLocal ? 100 : 60;
      reason = isLocal ? 'local node preferred' : 'local unavailable, using remote';
      break;

    case 'prefer-remote':
      score = isLocal ? 60 : 100;
      reason = isLocal ? 'remote preferred but local used' : 'remote node preferred';
      break;

    case 'highest-capacity':
      score = Math.min(capacity / 10, 1) * 100;
      reason = 'highest capacity node selected';
      break;

    case 'lowest-latency':
      score = Math.max(0, 100 - latencyMs);
      reason = `latency ${latencyMs}ms`;
      break;

    case 'balanced':
      score = (1 - load / capacity) * 40 + healthScore * 30 + (isLocal ? 30 : 0);
      reason = 'balanced selection across factors';
      break;
  }

  return { selected: score > 50, reason, score: Math.round(score) };
}

export function getPolicyDescription(policy: RoutingPolicy): string {
  const descriptions: Record<RoutingPolicy, string> = {
    'least-load': 'Select node with least current load',
    'round-robin': 'Distribute tasks evenly across nodes',
    'prefer-local': 'Prefer local execution when possible',
    'prefer-remote': 'Prefer remote execution for load distribution',
    'highest-capacity': 'Select node with highest capacity',
    'lowest-latency': 'Select node with lowest latency',
    'balanced': 'Balance load, health, and locality',
  };
  return descriptions[policy];
}
