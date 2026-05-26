import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

import {
  buildDashboardState,
  renderDashboardCompact,
} from '../../../src/runtime/mesh/mesh-dashboard-aggregator.js';

import {
  renderNodeCompact,
  renderNodeDetails,
  renderMeshNodes,
} from '../../../src/runtime/mesh/mesh-node-renderer.js';

import {
  renderCapabilityMap,
  renderCapabilityCoverage,
} from '../../../src/runtime/mesh/mesh-capability-map-renderer.js';

import {
  renderMeshHealth,
  renderHealthScore,
} from '../../../src/runtime/mesh/mesh-health-renderer.js';

import {
  renderRecentFailovers,
  renderFailoverSummary,
} from '../../../src/runtime/mesh/mesh-failover-renderer.js';

import {
  renderContractSummary,
  renderContractHealth,
} from '../../../src/runtime/mesh/mesh-contract-renderer.js';

import {
  renderRouteDecision,
  renderRecentRoutes,
} from '../../../src/runtime/mesh/mesh-route-renderer.js';

import {
  renderFullMeshDashboard,
  renderCompactMeshDashboard,
} from '../../../src/runtime/mesh/mesh-dashboard-full-renderer.js';

import {
  saveMeshDashboardSnapshot,
  getLastMeshDashboardSnapshot,
  listMeshDashboardSnapshots,
  clearMeshDashboardSnapshots,
} from '../../../src/runtime/mesh/mesh-dashboard-snapshot-store.js';

import type { MeshNodeInfo } from '../../../src/runtime/mesh/mesh-node-types.js';

describe('RC-57: Mesh Dashboard', () => {
  let sampleNodes: MeshNodeInfo[];

  before(() => {
    clearMeshDashboardSnapshots();

    sampleNodes = [
      {
        id: 'node1',
        name: 'primary',
        kind: 'primary',
        status: 'online',
        version: '1.0.0',
        address: 'http://localhost:9001',
        capabilities: [{ runtimeCapability: 'compute', taskTypes: ['compute'], capacity: 10, currentLoad: 3 }],
        connections: [],
        workerCount: 2,
        lastSeen: Date.now(),
        registeredAt: Date.now(),
        metadata: {},
      },
      {
        id: 'node2',
        name: 'worker-dead',
        kind: 'worker',
        status: 'dead',
        version: '1.0.0',
        address: 'http://localhost:9002',
        capabilities: [],
        connections: [],
        workerCount: 0,
        lastSeen: Date.now() - 200000,
        registeredAt: Date.now(),
        metadata: {},
      },
    ];
  });

  after(() => {
    clearMeshDashboardSnapshots();
  });

  it('aggregator builds state correctly', () => {
    const state = buildDashboardState(sampleNodes);
    assert.strictEqual(state.totalNodes, 2);
    assert.strictEqual(state.onlineNodes, 1);
    assert.strictEqual(state.deadNodes, 1);
    assert.ok(state.healthScore > 0);
  });

  it('node renderer works', () => {
    const compact = renderNodeCompact(sampleNodes[0]);
    assert.ok(compact.includes('primary'));
    const details = renderNodeDetails(sampleNodes[0]);
    assert.ok(details.includes('node1'));
    const all = renderMeshNodes(sampleNodes);
    assert.ok(all.includes('primary'));
  });

  it('capability renderer works', () => {
    const map = renderCapabilityMap(sampleNodes);
    assert.ok(map.includes('compute'));
    const coverage = renderCapabilityCoverage(sampleNodes);
    assert.ok(coverage.length >= 0);
  });

  it('health renderer works', () => {
    const state = buildDashboardState(sampleNodes);
    const health = renderMeshHealth(state);
    assert.ok(health.includes('Health'));
    const score = renderHealthScore(state);
    assert.ok(score.includes('%'));
  });

  it('failover renderer works', () => {
    const fakeFailover = {
      nodeId: 'node2',
      trigger: 'node_dead',
      strategy: 'immediate_reassign',
      reassignments: 1,
      successfulRecoveries: 1,
      failedRecoveries: 0,
      evidenceLinked: 1,
      healthImpact: 0,
      summary: 'ok',
      timestamp: Date.now(),
    };
    const rendered = renderFailoverSummary(fakeFailover);
    assert.ok(rendered.includes('node2'));
  });

  it('contract renderer works', () => {
    const fakeContract = {
      contractId: 'contract-1',
      totalFragments: 3,
      verifiedFragments: 2,
      participatingNodes: ['node1'],
      conflicts: { total: 0, byNode: {} },
      bindings: { total: 2, byStatus: {}, byNode: {} },
      verification: { total: 3, verified: 2, conflicted: 0, failed: 0, partial: 1 },
      healthScore: 85,
      generatedAt: Date.now(),
    };
    const summary = renderContractSummary(fakeContract);
    assert.ok(summary.includes('contract-1'));
  });

  it('route renderer works', () => {
    const fakeRoute = {
      capability: 'compute',
      taskType: 'compute',
      selectedNodeId: 'node1',
      selectedNodeName: 'primary',
      nodeAddress: '',
      score: 92,
      routeType: 'local',
      alternatives: [],
      timestamp: Date.now(),
    };
    const rendered = renderRouteDecision(fakeRoute);
    assert.ok(rendered.includes('compute'));
  });

  it('full dashboard renderer works', () => {
    const state = buildDashboardState(sampleNodes);
    const full = renderFullMeshDashboard(state);
    assert.ok(full.includes('MESH DASHBOARD'));
    const compact = renderCompactMeshDashboard(state);
    assert.ok(compact.includes('Health'));
  });

  it('snapshot store works', () => {
    const state = buildDashboardState(sampleNodes);
    const id = saveMeshDashboardSnapshot(state);
    assert.ok(id);
    const last = getLastMeshDashboardSnapshot();
    assert.ok(last);
    const list = listMeshDashboardSnapshots();
    assert.ok(list.length >= 1);
    clearMeshDashboardSnapshots();
    assert.strictEqual(getLastMeshDashboardSnapshot(), undefined);
  });

  it('index exports are available (basic smoke)', async () => {
    const mod = await import('../../../src/runtime/mesh/index.js');
    assert.ok(typeof mod.buildDashboardState === 'function');
    assert.ok(typeof mod.renderFullMeshDashboard === 'function');
  });
});
