import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

import { runPreflightGate } from '../../../src/runtime/mesh/mesh-preflight-gate.js';
import { generateMeshReadinessReport } from '../../../src/runtime/mesh/mesh-readiness-report.js';
import { exportMeshBaseline, hashMeshBaseline, compareMeshBaseline } from '../../../src/runtime/mesh/mesh-baseline-export.js';
import { validateMeshCommandScope, validateNodeTrust, validateRemoteExecutionBoundary } from '../../../src/runtime/mesh/mesh-security-boundary.js';
import { runMeshTimeoutTests } from '../../../src/runtime/mesh/mesh-timeout-tests.js';
import { runMeshLoadTests } from '../../../src/runtime/mesh/mesh-load-tests.js';
import { runMeshChaosTests } from '../../../src/runtime/mesh/mesh-chaos-tests.js';
import { runMeshRegressionSuite } from '../../../src/runtime/mesh/mesh-regression-suite.js';

describe('RC-60: Runtime Mesh Hardening', () => {
  before(() => {});

  after(() => {});

  it('preflight gate runs', async () => {
    const result = await runPreflightGate();
    assert.ok(result.verdict);
    assert.ok(result.score >= 0);
  });

  it('readiness report generates', async () => {
    const report = await generateMeshReadinessReport();
    assert.ok(report.overallVerdict);
    assert.ok(report.overallScore >= 0);
  });

  it('baseline export and hash work', () => {
    const fakeState = { nodes: [1,2], activeContracts: [], capabilitiesSummary: { compute: 3 } };
    const baseline = exportMeshBaseline(fakeState);
    assert.ok(baseline.hash);
    const hash = hashMeshBaseline(baseline);
    assert.strictEqual(baseline.hash, hash);
  });

  it('baseline comparison detects changes', () => {
    const fakeState = { nodes: [1], activeContracts: [], capabilitiesSummary: {} };
    const b1 = exportMeshBaseline(fakeState);
    const b2 = exportMeshBaseline({ nodes: [1,2,3], activeContracts: [], capabilitiesSummary: {} });
    const comparison = compareMeshBaseline(b1, b2);
    assert.ok(comparison.changed || comparison.diff.length > 0);
  });

  it('security boundary validates commands', () => {
    const req = { command: 'nodes', actorId: 'c1', timestamp: Date.now() } as any;
    const result = validateMeshCommandScope(req, ['nodes', 'health']);
    assert.strictEqual(result.allowed, true);
  });

  it('security boundary blocks untrusted nodes', () => {
    const result = validateNodeTrust('evil-node', ['trusted-1']);
    assert.strictEqual(result.allowed, false);
  });

  it('timeout tests run', async () => {
    const result = await runMeshTimeoutTests();
    assert.ok(result.verdict);
    assert.ok(result.score >= 0);
  });

  it('load tests run', async () => {
    const result = await runMeshLoadTests();
    assert.ok(result.verdict);
    assert.ok(result.score >= 0);
  });

  it('chaos tests run', async () => {
    const result = await runMeshChaosTests();
    assert.ok(result.verdict);
    assert.ok(result.score >= 0);
  });

  it('regression suite runs', async () => {
    const report = await runMeshRegressionSuite();
    assert.ok(report.overallVerdict);
    assert.ok(report.gates.length > 0);
  });
});
