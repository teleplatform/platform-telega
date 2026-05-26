import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import {
  buildCapabilityIndex,
  getNodesForCapability,
  getNodesForTaskType,
  getBestNodeForCapability,
  getCapabilityUtilization,
} from '../../src/runtime/mesh/mesh-capability-index.js';
import {
  routeCapability,
  batchRouteCapabilities,
  getRoutingStatistics,
} from '../../src/runtime/mesh/mesh-capability-router.js';
import {
  lookupWorkers,
  lookupWorkersByKind,
  getWorkerSummary,
} from '../../src/runtime/mesh/cross-node-worker-lookup.js';
import {
  scoreNode,
  scoreNodes,
} from '../../src/runtime/mesh/mesh-route-score-engine.js';
import {
  selectLocalOrRemote,
  analyzeNodeDistribution,
} from '../../src/runtime/mesh/local-vs-remote-selection.js';
import {
  evaluatePolicy,
  getPolicyDescription,
  DEFAULT_POLICY,
} from '../../src/runtime/mesh/mesh-routing-policy.js';
import {
  explainRouteDecision,
} from '../../src/runtime/mesh/mesh-route-explain.js';
import {
  registerMeshNode,
  getAllMeshNodes,
  clearMeshNodeStore,
} from '../../src/runtime/mesh/index.js';

describe('RC-50: Mesh Capability Routing', () => {
  before(() => {
    clearMeshNodeStore();
  });

  after(() => {
    clearMeshNodeStore();
  });

  describe('mesh-capability-index', () => {
    it('should build capability index from nodes', () => {
      const nodes = [
        registerMeshNode({
          name: 'node-compute',
          address: 'http://localhost:8080',
          capabilities: [{
            runtimeCapability: 'compute',
            taskTypes: ['compute'],
            capacity: 10,
            currentLoad: 3,
          }],
        }),
        registerMeshNode({
          name: 'node-storage',
          address: 'http://localhost:8081',
          capabilities: [{
            runtimeCapability: 'storage',
            taskTypes: ['store'],
            capacity: 5,
            currentLoad: 1,
          }],
        }),
      ];

      const index = buildCapabilityIndex(nodes);
      assert.ok(index.entries.size > 0);
      assert.ok(index.lastUpdated > 0);
    });

    it('should get nodes for specific capability', () => {
      const nodes = [
        registerMeshNode({
          name: 'compute-1',
          address: 'http://localhost:8080',
          capabilities: [{
            runtimeCapability: 'compute',
            taskTypes: ['compute'],
            capacity: 10,
            currentLoad: 3,
          }],
        }),
        registerMeshNode({
          name: 'compute-2',
          address: 'http://localhost:8081',
          capabilities: [{
            runtimeCapability: 'compute',
            taskTypes: ['compute'],
            capacity: 8,
            currentLoad: 2,
          }],
        }),
      ];

      const index = buildCapabilityIndex(nodes);
      const entry = getNodesForCapability(index, 'compute');
      assert.ok(entry);
      assert.strictEqual(entry.nodes.length, 2);
    });

    it('should get nodes by task type', () => {
      const nodes = [
        registerMeshNode({
          name: 'node-a',
          address: 'http://localhost:8080',
          capabilities: [{
            runtimeCapability: 'compute',
            taskTypes: ['compute'],
            capacity: 10,
            currentLoad: 0,
          }],
        }),
      ];

      const index = buildCapabilityIndex(nodes);
      const entries = getNodesForTaskType(index, 'compute');
      assert.ok(entries.length > 0);
    });

    it('should get best node for capability', () => {
      const nodes = [
        registerMeshNode({
          name: 'node-fast',
          address: 'http://localhost:8080',
          capabilities: [{
            runtimeCapability: 'compute',
            taskTypes: ['compute'],
            capacity: 10,
            currentLoad: 1,
          }],
        }),
        registerMeshNode({
          name: 'node-slow',
          address: 'http://localhost:8081',
          capabilities: [{
            runtimeCapability: 'compute',
            taskTypes: ['compute'],
            capacity: 10,
            currentLoad: 9,
          }],
        }),
      ];

      const index = buildCapabilityIndex(nodes);
      const best = getBestNodeForCapability(index, 'compute');
      assert.ok(best);
      assert.strictEqual(best.nodeInfo.name, 'node-fast');
    });
  });

  describe('mesh-capability-router', () => {
    it('should route capability to best node', () => {
      const nodes = [
        registerMeshNode({
          name: 'primary',
          address: 'http://localhost:8080',
          kind: 'primary',
          capabilities: [{
            runtimeCapability: 'compute',
            taskTypes: ['compute'],
            capacity: 10,
            currentLoad: 2,
          }],
        }),
        registerMeshNode({
          name: 'worker-1',
          address: 'http://localhost:8081',
          kind: 'worker',
          capabilities: [{
            runtimeCapability: 'compute',
            taskTypes: ['compute'],
            capacity: 8,
            currentLoad: 1,
          }],
        }),
      ];

      const decision = routeCapability(nodes, {
        capability: 'compute',
        taskType: 'compute',
      });

      assert.ok(decision.selectedNodeId);
      assert.ok(decision.score > 0);
    });

    it('should batch route multiple requests', () => {
      const nodes = [
        registerMeshNode({
          name: 'node-compute',
          address: 'http://localhost:8080',
          capabilities: [{
            runtimeCapability: 'compute',
            taskTypes: ['compute'],
            capacity: 10,
            currentLoad: 2,
          }],
        }),
      ];

      const decisions = batchRouteCapabilities(nodes, [
        { capability: 'compute', taskType: 'compute' },
      ]);

      assert.ok(decisions.length > 0);
    });
  });

  describe('cross-node-worker-lookup', () => {
    it('should lookup workers by capability', () => {
      const nodes = [
        registerMeshNode({
          name: 'worker-1',
          address: 'http://localhost:8080',
          kind: 'worker',
          workerCount: 3,
          capabilities: [{
            runtimeCapability: 'compute',
            taskTypes: ['compute'],
            capacity: 10,
            currentLoad: 2,
          }],
        }),
      ];

      const workers = lookupWorkers(nodes, { capability: 'compute', maxResults: 5 });
      assert.ok(workers.length > 0);
    });

    it('should get worker summary', () => {
      const nodes = [
        registerMeshNode({
          name: 'worker-1',
          address: 'http://localhost:8080',
          kind: 'worker',
          workerCount: 3,
          capabilities: [{
            runtimeCapability: 'compute',
            taskTypes: ['compute'],
            capacity: 10,
            currentLoad: 2,
          }],
        }),
      ];

      const summary = getWorkerSummary(nodes);
      assert.ok(summary.totalWorkers > 0);
    });
  });

  describe('mesh-route-score-engine', () => {
    it('should score nodes correctly', () => {
      const nodes = [
        registerMeshNode({
          name: 'node-1',
          address: 'http://localhost:8080',
          status: 'online',
          uptimeMs: 86400000,
          workerCount: 2,
          capabilities: [{
            runtimeCapability: 'compute',
            taskTypes: ['compute'],
            capacity: 10,
            currentLoad: 2,
          }],
        }),
      ];

      const score = scoreNode(nodes[0], nodes[0].capabilities[0]);
      assert.ok(score.totalScore > 0);
      assert.ok(score.factors.loadBalance >= 0);
      assert.ok(score.factors.health >= 0);
    });

    it('should score multiple nodes and rank them', () => {
      const nodes = [
        registerMeshNode({
          name: 'node-1',
          address: 'http://localhost:8080',
          status: 'online',
          capabilities: [{
            runtimeCapability: 'compute',
            taskTypes: ['compute'],
            capacity: 10,
            currentLoad: 2,
          }],
        }),
        registerMeshNode({
          name: 'node-2',
          address: 'http://localhost:8081',
          status: 'online',
          capabilities: [{
            runtimeCapability: 'compute',
            taskTypes: ['compute'],
            capacity: 10,
            currentLoad: 8,
          }],
        }),
      ];

      const scores = scoreNodes(nodes, nodes[0].capabilities[0]);
      assert.ok(scores.length >= 2);
      assert.ok(scores[0].rank === 1);
    });
  });

  describe('local-vs-remote-selection', () => {
    it('should select local over remote when preferred', () => {
      const nodes = [
        registerMeshNode({
          name: 'primary',
          address: 'http://localhost:8080',
          kind: 'primary',
          capabilities: [{
            runtimeCapability: 'compute',
            taskTypes: ['compute'],
            capacity: 10,
            currentLoad: 2,
          }],
        }),
        registerMeshNode({
          name: 'worker',
          address: 'http://localhost:8081',
          kind: 'worker',
          capabilities: [{
            runtimeCapability: 'compute',
            taskTypes: ['compute'],
            capacity: 10,
            currentLoad: 1,
          }],
        }),
      ];

      const decision = selectLocalOrRemote(nodes, {
        capability: 'compute',
        preferLocal: true,
      });

      assert.ok(decision.selectedNodeId);
    });
  });

  describe('mesh-routing-policy', () => {
    it('should evaluate policies correctly', () => {
      const result = evaluatePolicy('least-load', {
        load: 3,
        capacity: 10,
        isLocal: true,
        latencyMs: 50,
        healthScore: 1,
        nodeCount: 3,
      });

      assert.ok(result.score > 0);
      assert.ok(result.reason);
    });

    it('should have default policy configuration', () => {
      assert.ok(DEFAULT_POLICY.policy === 'balanced');
      assert.ok(DEFAULT_POLICY.maxRetries === 3);
    });
  });

  describe('mesh-route-explain', () => {
    it('should explain route decisions', () => {
      const nodes = [
        registerMeshNode({
          name: 'node-1',
          address: 'http://localhost:8080',
          capabilities: [{
            runtimeCapability: 'compute',
            taskTypes: ['compute'],
            capacity: 10,
            currentLoad: 2,
          }],
        }),
      ];

      const decision = routeCapability(nodes, {
        capability: 'compute',
        taskType: 'compute',
      });

      const explanation = explainRouteDecision(decision, nodes);
      assert.ok(explanation.decision);
      assert.ok(explanation.confidence >= 0);
    });
  });
});
