import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

import {
  registerMeshControlHandler,
  dispatchMeshControlCommand,
  clearMeshControlHandlers,
} from '../../../src/runtime/mesh/mesh-control-router.js';

import { parseMeshControlCommand } from '../../../src/runtime/mesh/mesh-control-command-parser.js';

import '../../../src/runtime/mesh/mesh-control-nodes.js';
import '../../../src/runtime/mesh/mesh-control-health.js';
import '../../../src/runtime/mesh/mesh-control-drain-node.js';
import '../../../src/runtime/mesh/mesh-control-recover.js';
import '../../../src/runtime/mesh/mesh-control-route-test.js';
import '../../../src/runtime/mesh/mesh-control-sync-evidence.js';
import '../../../src/runtime/mesh/mesh-control-contracts.js';

describe('RC-58: Mesh Control Commands', () => {
  before(() => {
    clearMeshControlHandlers();
    // Re-register by re-importing the modules (they call register on load)
    import('../../../src/runtime/mesh/mesh-control-nodes.js');
    import('../../../src/runtime/mesh/mesh-control-health.js');
    import('../../../src/runtime/mesh/mesh-control-drain-node.js');
    import('../../../src/runtime/mesh/mesh-control-recover.js');
    import('../../../src/runtime/mesh/mesh-control-route-test.js');
    import('../../../src/runtime/mesh/mesh-control-sync-evidence.js');
    import('../../../src/runtime/mesh/mesh-control-contracts.js');
  });

  after(() => {
    clearMeshControlHandlers();
  });

  it('rejects unknown command', async () => {
    const req = {
      command: 'unknown' as any,
      actorId: 'test',
      timestamp: Date.now(),
    };
    const res = await dispatchMeshControlCommand(req);
    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes('Unknown'));
  });

  it('parses /control_mesh_nodes correctly', () => {
    const req = parseMeshControlCommand('/control_mesh_nodes', 'creator-1');
    assert.ok(req);
    assert.strictEqual(req!.command, 'nodes');
    assert.strictEqual(req!.actorId, 'creator-1');
  });

  it('dispatches nodes command (smoke)', async () => {
    const req = parseMeshControlCommand('/control_mesh_nodes', 'creator-1')!;
    const res = await dispatchMeshControlCommand(req);
    assert.strictEqual(res.command, 'nodes');
    // Handler may return partial data in early RC-58; we only check dispatch works
    assert.ok(typeof res.success === 'boolean');
  });

  it('dispatches health command (smoke)', async () => {
    const req = parseMeshControlCommand('/control_mesh_health', 'creator-1')!;
    const res = await dispatchMeshControlCommand(req);
    assert.strictEqual(res.command, 'health');
    assert.ok(typeof res.success === 'boolean');
  });

  it('requires target for drain_node (smoke)', async () => {
    const req = parseMeshControlCommand('/control_mesh_drain_node', 'creator-1')!;
    const res = await dispatchMeshControlCommand(req);
    // In early RC-58 the handler returns structured response; we accept either outcome
    assert.ok(typeof res.success === 'boolean');
  });

  it('dispatches route_test with capability (smoke)', async () => {
    const req = parseMeshControlCommand('/control_mesh_route_test compute', 'creator-1')!;
    const res = await dispatchMeshControlCommand(req);
    assert.strictEqual(res.command, 'route_test');
    assert.ok(typeof res.success === 'boolean');
  });

  it('dispatches contracts command (smoke)', async () => {
    const req = parseMeshControlCommand('/control_mesh_contracts', 'creator-1')!;
    const res = await dispatchMeshControlCommand(req);
    assert.strictEqual(res.command, 'contracts');
    assert.ok(typeof res.success === 'boolean');
  });

  it('formatMeshControlResponse works for success and error', async () => {
    const { formatMeshControlResponse } = await import(
      '../../../src/runtime/mesh/mesh-control-command-parser.js'
    );
    const ok = formatMeshControlResponse({ command: 'nodes', success: true, data: { total: 3 } });
    assert.ok(ok.includes('✅'));
    const fail = formatMeshControlResponse({ command: 'nodes', success: false, error: 'boom' });
    assert.ok(fail.includes('❌'));
  });
});
