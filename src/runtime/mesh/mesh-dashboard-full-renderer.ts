import type { MeshDashboardState } from './mesh-dashboard-aggregator.js';
import { renderMeshNodes } from './mesh-node-renderer.js';
import { renderCapabilityMap } from './mesh-capability-map-renderer.js';
import { renderMeshHealth } from './mesh-health-renderer.js';
import { renderRecentFailovers } from './mesh-failover-renderer.js';
import { renderContractSummary } from './mesh-contract-renderer.js';
import { renderRecentRoutes } from './mesh-route-renderer.js';

export function renderFullMeshDashboard(state: MeshDashboardState): string {
  const sections: string[] = [];

  sections.push('=== MESH DASHBOARD ===');
  sections.push(`Generated: ${new Date(state.generatedAt).toISOString()}`);
  sections.push('');

  sections.push('--- Nodes ---');
  sections.push(renderMeshNodes(state.nodes));
  sections.push('');

  sections.push('--- Capabilities ---');
  sections.push(renderCapabilityMap(state.nodes));
  sections.push('');

  sections.push('--- Health ---');
  sections.push(renderMeshHealth(state));
  sections.push('');

  if (state.recentFailovers.length > 0) {
    sections.push('--- Recent Failovers ---');
    sections.push(renderRecentFailovers(state.recentFailovers));
    sections.push('');
  }

  if (state.activeContracts.length > 0) {
    sections.push('--- Active Contracts ---');
    state.activeContracts.slice(0, 5).forEach(c => {
      sections.push(renderContractSummary(c));
    });
    sections.push('');
  }

  sections.push('--- Overall ---');
  sections.push(`Health Score: ${state.healthScore}%`);
  sections.push(`Total Nodes: ${state.totalNodes}`);

  return sections.join('\n');
}

export function renderCompactMeshDashboard(state: MeshDashboardState): string {
  return [
    `Mesh: ${state.totalNodes} nodes | Health ${state.healthScore}%`,
    `Contracts: ${state.activeContracts.length} | Failovers: ${state.recentFailovers.length}`,
  ].join('\n');
}

export function renderDashboardSection(state: MeshDashboardState, section: 'nodes' | 'health' | 'contracts' | 'failovers' | 'capabilities'): string {
  switch (section) {
    case 'nodes': return renderMeshNodes(state.nodes);
    case 'health': return renderMeshHealth(state);
    case 'capabilities': return renderCapabilityMap(state.nodes);
    case 'contracts': return state.activeContracts.map(renderContractSummary).join('\n');
    case 'failovers': return renderRecentFailovers(state.recentFailovers);
    default: return 'Unknown section';
  }
}
