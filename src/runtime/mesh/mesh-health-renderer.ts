import type { MeshDashboardState } from './mesh-dashboard-aggregator.ts';

export function renderHealthScore(state: MeshDashboardState): string {
  const pct = state.healthScore;
  let emoji = '🟢';
  if (pct < 70) emoji = '🟡';
  if (pct < 40) emoji = '🔴';

  return `${emoji} Mesh Health: ${pct}% (${state.onlineNodes}/${state.totalNodes} online)`;
}

export function renderDeadNodes(state: MeshDashboardState): string {
  if (state.deadNodes === 0) return 'No dead nodes.';
  return `🔴 Dead nodes: ${state.deadNodes}`;
}

export function renderDegradedNodes(state: MeshDashboardState): string {
  const degraded = state.nodes.filter(n => n.status === 'degraded').length;
  if (degraded === 0) return 'No degraded nodes.';
  return `🟡 Degraded nodes: ${degraded}`;
}

export function renderMeshHealth(state: MeshDashboardState): string {
  const lines: string[] = [];
  lines.push(renderHealthScore(state));
  lines.push(renderDeadNodes(state));
  lines.push(renderDegradedNodes(state));

  if (state.nodes.length > 0) {
    const avgLatency = state.nodes.reduce((sum, n) => {
      const connLatency = n.connections.reduce((s, c) => s + c.latencyMs, 0);
      return sum + (connLatency / Math.max(1, n.connections.length));
    }, 0) / state.nodes.length;

    lines.push(`Avg latency: ${Math.round(avgLatency)}ms`);
  }

  return lines.join('\n');
}
