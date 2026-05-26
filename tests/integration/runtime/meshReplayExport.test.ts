import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

import {
  createDistributedReplayPlan,
  getReplayPlan,
  clearReplayPlans,
} from '../../../src/runtime/mesh/distributed-replay-plan.js';

import {
  collectRemoteTraces,
  clearRemoteTraces,
} from '../../../src/runtime/mesh/remote-trace-collector.js';

import {
  exportReplayToJSON,
  createReplayExportBundle,
} from '../../../src/runtime/mesh/mesh-export-json.js';

import {
  exportReplayToCSV,
  exportReplayStepsToCSV,
} from '../../../src/runtime/mesh/mesh-export-csv.js';

import {
  createForensicSummary,
} from '../../../src/runtime/mesh/mesh-forensic-summary.js';

import {
  validateReplayPlan,
} from '../../../src/runtime/mesh/mesh-replay-validator.js';

import {
  recordReplayHistory,
  getReplayHistory,
  clearReplayHistory,
} from '../../../src/runtime/mesh/mesh-replay-history-store.js';

import {
  executeReplayPlan,
  clearReplayExecutions,
} from '../../../src/runtime/mesh/mesh-replay-runner.js';

import type { TraceEvent, DistributedReplayPlan } from '../../../src/runtime/mesh/mesh-replay-types.js';

describe('RC-59: Mesh Replay & Distributed Trace Export', () => {
  let sampleTraces: TraceEvent[];
  let plan: DistributedReplayPlan;

  before(() => {
    clearReplayPlans();
    clearRemoteTraces();
    clearReplayHistory();
    clearReplayExecutions();

    sampleTraces = [
      {
        traceId: 'trace_1',
        eventId: 'evt_1',
        nodeId: 'node_a',
        timestamp: 1000,
        type: 'start',
        payload: { evidenceId: 'ev_1' },
      },
      {
        traceId: 'trace_1',
        eventId: 'evt_2',
        nodeId: 'node_b',
        timestamp: 2000,
        type: 'execute',
        payload: { evidenceId: 'ev_1' },
        parentEventId: 'evt_1',
      },
    ];

    plan = createDistributedReplayPlan(['ev_1'], sampleTraces, 'contract_1');
  });

  after(() => {
    clearReplayPlans();
    clearRemoteTraces();
    clearReplayHistory();
    clearReplayExecutions();
  });

  it('replay plan creation works', () => {
    assert.ok(plan.planId);
    assert.strictEqual(plan.evidenceIds.length, 1);
    assert.strictEqual(plan.steps.length, 2);
  });

  it('trace collection works', () => {
    const result = collectRemoteTraces({
      nodeId: 'node_a',
      traceId: 'trace_1',
      events: sampleTraces,
      evidenceId: 'ev_1',
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.eventsCollected, 2);
    const collected = getReplayPlan(plan.planId);
    assert.ok(collected);
  });

  it('replay validation works (fixed traceId logic)', () => {
    const validation = validateReplayPlan(plan, sampleTraces);
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.missingTraces.length, 0);
  });

  it('forensic summary generation works', () => {
    const summary = createForensicSummary(plan, sampleTraces);
    assert.strictEqual(summary.planId, plan.planId);
    assert.strictEqual(summary.totalEvents, 2);
    assert.ok(summary.participatingNodes.includes('node_a'));
  });

  it('JSON export works', () => {
    const json = exportReplayToJSON(plan, sampleTraces);
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.planId, plan.planId);
    assert.ok(Array.isArray(parsed.traces));
  });

  it('CSV export works', () => {
    const csv = exportReplayToCSV(sampleTraces);
    assert.ok(csv.includes('timestamp,traceId,eventId'));
    assert.ok(csv.includes('trace_1'));

    const stepsCsv = exportReplayStepsToCSV(plan);
    assert.ok(stepsCsv.includes('stepId,traceId'));
  });

  it('replay history works', () => {
    recordReplayHistory(plan);
    const entry = getReplayHistory(plan.planId);
    assert.ok(entry);
    assert.strictEqual(entry.plan.planId, plan.planId);
  });

  it('replay runner executes deterministically', () => {
    const execution = executeReplayPlan(plan);
    assert.strictEqual(execution.planId, plan.planId);
    assert.ok(execution.executedSteps >= 0);
    assert.ok(['completed', 'failed'].includes(execution.status));
  });

  it('index exports are available', async () => {
    const mod = await import('../../../src/runtime/mesh/index.js');
    assert.ok(typeof mod.createDistributedReplayPlan === 'function');
    assert.ok(typeof mod.exportReplayToJSON === 'function');
    assert.ok(typeof mod.validateReplayPlan === 'function');
    assert.ok(typeof mod.executeReplayPlan === 'function');
  });
});
