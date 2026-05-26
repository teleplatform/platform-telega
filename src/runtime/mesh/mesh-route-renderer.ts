import type { RouteDecision } from './mesh-capability-router.js';

export function renderRouteDecision(decision: RouteDecision): string {
  return `${decision.taskType} → ${decision.selectedNodeName} (score ${decision.score}) [${decision.routeType}]`;
}

export function renderRouteScore(decision: RouteDecision): string {
  return `Score: ${decision.score} | Alternatives: ${decision.alternatives.map(a => `${a.nodeId}:${a.score}`).join(', ')}`;
}

export function renderRouteExplanation(decision: RouteDecision): string {
  return [
    `Route: ${decision.taskType} → ${decision.selectedNodeName}`,
    `Type: ${decision.routeType}`,
    `Score: ${decision.score}`,
    `Reason: ${decision.alternatives[0]?.reason || 'best available'}`,
  ].join('\n');
}

export function renderRecentRoutes(decisions: RouteDecision[]): string {
  if (decisions.length === 0) return 'No recent routes.';
  return decisions.slice(0, 5).map(renderRouteDecision).join('\n');
}
