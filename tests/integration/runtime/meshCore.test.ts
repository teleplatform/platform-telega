import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';

import {
  registerMeshNode, unregisterMeshNode, getMeshNode, getAllMeshNodes,
  getOnlineMeshNodes, getMeshNodesByCapability, getMeshNodesByTaskType,
  getMeshNodesByKind, updateMeshNodeStatus, updateMeshNodeHeartbeat,
  addMeshNodeConnection, removeMeshNodeConnection, getMeshNodeCountByStatus,
  meshNodeRegistrySummary, reloadMeshNodesFromStore,
} from '../../../src/runtime/mesh/index.js';

import {
  persistMeshNode, removeMeshNode, loadMeshNodes, loadMeshNode,
  getMeshNodeCount, clearMeshNodeStore, meshNodeStoreSummary,
} from '../../../src/runtime/mesh/index.js';

import {
  setDiscoveryConfig, getDiscoveryConfig, handleMeshNodeDiscovery,
} from '../../../src/runtime/mesh/index.js';

import {
  sweepDeadMeshNodes, getMeshHeartbeatStats, isMeshNodeHealthy,
  meshHeartbeatSummary, startMeshHeartbeatMonitor, stopMeshHeartbeatMonitor,
} from '../../../src/runtime/mesh/index.js';

import {
  buildMeshHealthMap, renderMeshHealthStatus, renderMeshNodeCompact,
} from '../../../src/runtime/mesh/index.js';

describe('RC-49: Runtime Mesh Core', () => {
  before(() => {
    clearMeshNodeStore();
  });

  after(() => {
    clearMeshNodeStore();
    stopMeshHeartbeatMonitor();
  });

  describe('runtime-node-registry', () => {
    it('should register a mesh node', () => {
      const node = registerMeshNode({
        name: 'node-alpha',
        address: 'http://localhost:3001',
        kind: 'primary',
        version: '2.0.0',
        capabilities: [{
          runtimeCapability: 'browser',
          taskTypes: ['browser.navigate', 'browser.click'],
          capacity: 5,
          currentLoad: 0,
        }],
      });

      assert.ok(node.id);
      assert.strictEqual(node.name, 'node-alpha');
      assert.strictEqual(node.kind, 'primary');
      assert.strictEqual(node.status, 'online');
      assert.strictEqual(node.version, '2.0.0');
      assert.strictEqual(node.address, 'http://localhost:3001');
      assert.strictEqual(node.capabilities.length, 1);
      assert.strictEqual(node.capabilities[0].runtimeCapability, 'browser');
    });

    it('should retrieve a node by id', () => {
      const node = registerMeshNode({ name: 'node-beta', address: 'http://localhost:3002' });
      const retrieved = getMeshNode(node.id);
      assert.ok(retrieved);
      assert.strictEqual(retrieved!.id, node.id);
      assert.strictEqual(retrieved!.name, 'node-beta');
    });

    it('should unregister a node', () => {
      const node = registerMeshNode({ name: 'node-to-remove', address: 'http://localhost:3003' });
      assert.ok(getMeshNode(node.id));
      const removed = unregisterMeshNode(node.id);
      assert.strictEqual(removed, true);
      assert.strictEqual(getMeshNode(node.id), undefined);
    });

    it('should list all mesh nodes', () => {
      registerMeshNode({ name: 'node-gamma', address: 'http://localhost:3004' });
      registerMeshNode({ name: 'node-delta', address: 'http://localhost:3005' });
      const all = getAllMeshNodes();
      assert.ok(all.length >= 2);
    });

    it('should filter by status', () => {
      const node = registerMeshNode({ name: 'node-epsilon', address: 'http://localhost:3006' });
      updateMeshNodeStatus(node.id, 'offline');
      const online = getOnlineMeshNodes();
      for (const n of online) {
        assert.strictEqual(n.status, 'online');
      }
    });

    it('should filter by capability', () => {
      registerMeshNode({
        name: 'node-exec', address: 'http://localhost:3007',
        capabilities: [{
          runtimeCapability: 'execution',
          taskTypes: ['execution.shell'],
          capacity: 3, currentLoad: 1,
        }],
      });
      const execNodes = getMeshNodesByCapability('execution');
      assert.ok(execNodes.length >= 1);
      for (const n of execNodes) {
        assert.ok(n.capabilities.some(c => c.runtimeCapability === 'execution'));
      }
    });

    it('should filter by task type', () => {
      const nodes = getMeshNodesByTaskType('execution.shell');
      for (const n of nodes) {
        assert.ok(n.capabilities.some(c => c.taskTypes.includes('execution.shell')));
      }
    });

    it('should filter by kind', () => {
      registerMeshNode({ name: 'edge-node', address: 'http://localhost:3008', kind: 'edge' });
      const edgeNodes = getMeshNodesByKind('edge');
      assert.ok(edgeNodes.length >= 1);
      for (const n of edgeNodes) {
        assert.strictEqual(n.kind, 'edge');
      }
    });

    it('should update node status', () => {
      const node = registerMeshNode({ name: 'status-test', address: 'http://localhost:3009' });
      assert.strictEqual(node.status, 'online');

      updateMeshNodeStatus(node.id, 'draining');
      assert.strictEqual(getMeshNode(node.id)!.status, 'draining');

      updateMeshNodeStatus(node.id, 'degraded');
      assert.strictEqual(getMeshNode(node.id)!.status, 'degraded');
    });

    it('should update node heartbeat', () => {
      const node = registerMeshNode({ name: 'hb-test', address: 'http://localhost:3010' });
      updateMeshNodeHeartbeat(node.id, 'online', 5, 3, 512, 3600000);
      const updated = getMeshNode(node.id);
      assert.strictEqual(updated!.workerCount, 5);
      assert.strictEqual(updated!.status, 'online');
    });

    it('should manage connections', () => {
      const nodeA = registerMeshNode({ name: 'conn-a', address: 'http://localhost:3011' });
      const nodeB = registerMeshNode({ name: 'conn-b', address: 'http://localhost:3012' });

      addMeshNodeConnection(nodeA.id, {
        nodeId: nodeB.id,
        address: nodeB.address,
        connectedAt: Date.now(),
        lastSeen: Date.now(),
        latencyMs: 5,
        status: 'active',
      });

      const aNode = getMeshNode(nodeA.id);
      assert.strictEqual(aNode!.connections.length, 1);
      assert.strictEqual(aNode!.connections[0].nodeId, nodeB.id);

      addMeshNodeConnection(nodeA.id, {
        nodeId: nodeB.id,
        address: nodeB.address,
        connectedAt: Date.now() - 1000,
        lastSeen: Date.now(),
        latencyMs: 3,
        status: 'active',
      });

      const updatedA = getMeshNode(nodeA.id);
      assert.strictEqual(updatedA!.connections.length, 1);
      assert.strictEqual(updatedA!.connections[0].latencyMs, 3);

      removeMeshNodeConnection(nodeA.id, nodeB.id);
      assert.strictEqual(getMeshNode(nodeA.id)!.connections.length, 0);
    });

    it('should count nodes by status', () => {
      const counts = getMeshNodeCountByStatus();
      assert.ok(typeof counts['online'] === 'number');
      assert.ok(typeof counts['offline'] === 'number');
    });

    it('should generate registry summary', () => {
      const summary = meshNodeRegistrySummary();
      assert.ok(summary.includes('Mesh nodes:'));
      assert.ok(summary.includes('online='));
      assert.ok(summary.includes('capabilities='));
    });

    it('should reload from store', () => {
      const node = registerMeshNode({ name: 'reload-test', address: 'http://localhost:3099' });
      const id = node.id;
      reloadMeshNodesFromStore();
      const reloaded = getMeshNode(id);
      assert.ok(reloaded);
      assert.strictEqual(reloaded!.name, 'reload-test');
    });
  });

  describe('mesh-node-status-store', () => {
    it('should persist and load nodes', () => {
      const node = registerMeshNode({ name: 'persist-test', address: 'http://localhost:3100' });
      const stored = loadMeshNode(node.id);
      assert.ok(stored);
      assert.strictEqual(stored!.name, 'persist-test');

      const all = loadMeshNodes();
      assert.ok(all.length >= 1);

      const count = getMeshNodeCount();
      assert.ok(count >= 1);

      const summary = meshNodeStoreSummary();
      assert.ok(summary.includes('Mesh node store:'));
    });

    it('should remove persisted node', () => {
      const node = registerMeshNode({ name: 'remove-persist', address: 'http://localhost:3101' });
      assert.ok(loadMeshNode(node.id));
      removeMeshNode(node.id);
      assert.strictEqual(loadMeshNode(node.id), undefined);
    });

    it('should clear the store', () => {
      clearMeshNodeStore();
      assert.strictEqual(getMeshNodeCount(), 0);
    });
  });

  describe('mesh-node-discovery', () => {
    it('should set and get discovery config', () => {
      const config = {
        runtimeId: 'rt-001',
        name: 'test-runtime',
        version: '1.0.0',
        address: 'http://localhost:3000',
        capabilities: [{ runtimeCapability: 'browser', taskTypes: ['browser.navigate'], capacity: 5 }],
        authToken: 'test-token',
      };
      setDiscoveryConfig(config);
      const retrieved = getDiscoveryConfig();
      assert.ok(retrieved);
      assert.strictEqual(retrieved!.runtimeId, 'rt-001');
      assert.strictEqual(retrieved!.name, 'test-runtime');
    });

    it('should handle mesh node discovery request', () => {
      const request = {
        runtimeId: 'remote-rt-001',
        name: 'remote-runtime',
        version: '2.0.0',
        address: 'http://remote:3000',
        capabilities: [{ runtimeCapability: 'execution' as const, taskTypes: ['execution.shell' as const], capacity: 3 }],
        status: 'online' as const,
      };

      const response = handleMeshNodeDiscovery(request);
      assert.ok(response.ok);
      assert.strictEqual(response.nodeId, 'rt-001');

      const remoteNode = getMeshNode('remote-rt-001');
      assert.ok(remoteNode);
      assert.strictEqual(remoteNode!.name, 'remote-runtime');
      assert.strictEqual(remoteNode!.address, 'http://remote:3000');
    });

    it('should return known nodes in discovery response', () => {
      registerMeshNode({ name: 'known-node', address: 'http://known:3000' });

      const response = handleMeshNodeDiscovery({
        runtimeId: 'another-remote',
        name: 'another',
        version: '1.0.0',
        address: 'http://another:3000',
        capabilities: [],
        status: 'online',
      });

      assert.ok(response.ok);
      assert.ok(response.knownNodes.length >= 1);
      const known = response.knownNodes.find(k => k.name === 'known-node');
      assert.ok(known);
    });

    it('should fail discovery without config', () => {
      setDiscoveryConfig(null as any);
      const response = handleMeshNodeDiscovery({
        runtimeId: 'x', name: 'x', version: '1', address: 'http://x:3000',
        capabilities: [], status: 'online',
      });
      assert.strictEqual(response.ok, false);
      assert.ok(response.error);
    });

    it('should restore discovery config', () => {
      setDiscoveryConfig({
        runtimeId: 'rt-001', name: 'test-runtime', version: '1.0.0',
        address: 'http://localhost:3000',
        capabilities: [{ runtimeCapability: 'browser', taskTypes: ['browser.navigate'], capacity: 5 }],
        authToken: 'test-token',
      });
    });
  });

  describe('mesh-heartbeat', () => {
    it('should detect dead nodes via sweep', () => {
      const now = Date.now();
      const node = registerMeshNode({
        name: 'stale-node',
        address: 'http://localhost:3999',
        lastSeen: now - 300000,
        registeredAt: now - 600000,
      });

      const { dead, degraded } = sweepDeadMeshNodes();
      assert.ok(dead.includes(node.id) || degraded.includes(node.id));
    });

    it('should provide heartbeat stats', () => {
      const stats = getMeshHeartbeatStats();
      assert.ok(typeof stats.totalHeartbeats === 'number');
      assert.ok(typeof stats.failures === 'number');
      assert.ok(typeof stats.healthyNodes === 'number');
    });

    it('should check node health', () => {
      const node = registerMeshNode({
        name: 'health-check', address: 'http://localhost:4000',
        lastSeen: Date.now(),
      });
      assert.ok(isMeshNodeHealthy(node.id));

      updateMeshNodeStatus(node.id, 'dead');
      assert.strictEqual(isMeshNodeHealthy(node.id), false);
    });

    it('should return false for unknown node health', () => {
      assert.strictEqual(isMeshNodeHealthy('nonexistent'), false);
    });

    it('should generate heartbeat summary', () => {
      const summary = meshHeartbeatSummary();
      assert.ok(summary.includes('Mesh heartbeat:'));
    });

    it('should start and stop monitor', () => {
      startMeshHeartbeatMonitor();
      startMeshHeartbeatMonitor();
      stopMeshHeartbeatMonitor();
      stopMeshHeartbeatMonitor();
    });
  });

  describe('mesh-health-map', () => {
    it('should build health map', () => {
      const map = buildMeshHealthMap();
      assert.ok(map.totalNodes >= 1);
      assert.ok(typeof map.online === 'number');
      assert.ok(typeof map.averageLatencyMs === 'number');
      assert.ok(map.generatedAt);
      assert.ok(Array.isArray(map.entries));

      for (const entry of map.entries) {
        assert.ok(entry.nodeId);
        assert.ok(entry.status);
        assert.ok(entry.name);
        assert.ok(typeof entry.lastSeen === 'number');
      }
    });

    it('should render health status', () => {
      const rendered = renderMeshHealthStatus();
      assert.ok(rendered.includes('Mesh Health Map'));
      assert.ok(rendered.includes('Nodes:'));
      assert.ok(rendered.includes('online='));
    });

    it('should render compact node info', () => {
      const node = registerMeshNode({ name: 'compact-test', address: 'http://localhost:5000' });
      const rendered = renderMeshNodeCompact(node.id);
      assert.ok(rendered.includes(node.name));

      const missing = renderMeshNodeCompact('nonexistent-node');
      assert.ok(missing.includes('not found'));
    });
  });
});
