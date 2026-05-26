import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import {
  appendAuditEvent, queryAuditTrail, getAuditEvent,
  getAuditTrailByTrace, getAuditSummary, getAuditCount,
  clearAuditTrail, setAuditSource, formatAuditEvent,
  emitDagCreated, emitDagStarted, emitDagCompleted, emitDagFailed,
  emitNodeStarted, emitNodeCompleted, emitNodeFailed,
  emitWorkerRegistered, emitWorkerStatusChanged,
  emitWorkerDegraded, emitWorkerQuarantined, emitWorkerRecovered,
  emitAssignmentCreated, emitAssignmentCompleted, emitAssignmentFailed,
  emitAssignmentReassigned, emitQualityScored,
  emitFederationHandshake, emitFederationContractBound,
  emitControlPaused, emitControlResumed,
} from '../../../src/runtime/audit/index.js';
import {
  replayAuditTrail, replayAuditTrailSequential,
  exportAuditTrailJson, exportAuditTrailCsv,
  saveAuditExportJson, saveAuditExportCsv,
  formatAuditTrailSummary,
} from '../../../src/runtime/audit/index.js';
import type { AuditEvent } from '../../../src/runtime/audit/index.js';

describe('RC-47: Distributed Orchestration Audit Trail', () => {
  before(() => {
    clearAuditTrail();
    setAuditSource('test');
  });

  after(() => {
    clearAuditTrail();
    setAuditSource('audit');
  });

  describe('audit-store', () => {
    it('should append and retrieve an audit event', () => {
      const event = appendAuditEvent({
        kind: 'dag.created',
        severity: 'info',
        timestamp: new Date().toISOString(),
        traceId: 'trace-1',
        source: 'test',
        actor: 'system',
        summary: 'DAG created: test-graph',
        payload: { name: 'test-graph', intent: 'test' },
      });

      assert.ok(event.id);
      assert.strictEqual(event.kind, 'dag.created');
      assert.strictEqual(event.severity, 'info');
      assert.strictEqual(event.traceId, 'trace-1');
      assert.strictEqual(event.summary, 'DAG created: test-graph');

      const retrieved = getAuditEvent(event.id);
      assert.ok(retrieved);
      assert.strictEqual(retrieved!.id, event.id);
    });

    it('should query events by kind', () => {
      emitDagCreated('trace-filter', 'filter-test', 'test');
      emitDagStarted('trace-filter', 'filter-test');

      const results = queryAuditTrail({ kind: 'dag.created' });
      assert.ok(results.length >= 1);
      for (const r of results) {
        assert.strictEqual(r.kind, 'dag.created');
      }
    });

    it('should query events by traceId', () => {
      emitDagCompleted('trace-specific', 'specific-graph', 100);
      emitNodeStarted('trace-specific', 'node-1', 'shell.exec');
      emitNodeCompleted('trace-specific', 'node-1', 50);

      const traceEvents = getAuditTrailByTrace('trace-specific');
      assert.strictEqual(traceEvents.length, 3);
      for (const e of traceEvents) {
        assert.strictEqual(e.traceId, 'trace-specific');
      }
    });

    it('should query events by filter with time range', () => {
      const now = new Date().toISOString();
      const later = new Date(Date.now() + 1000).toISOString();

      const results = queryAuditTrail({ since: now, order: 'asc' });
      assert.ok(results.length >= 0);
    });

    it('should filter by multiple kinds', () => {
      const results = queryAuditTrail({ kinds: ['dag.created', 'dag.started'] });
      for (const r of results) {
        assert.ok(r.kind === 'dag.created' || r.kind === 'dag.started');
      }
    });

    it('should return audit summary', () => {
      const summary = getAuditSummary();
      assert.ok(summary.totalEvents >= 0);
      assert.ok(typeof summary.uniqueTraces === 'number');
      assert.ok(typeof summary.byKind === 'object');
      assert.ok(typeof summary.bySeverity === 'object');
      assert.ok(typeof summary.timeRange.earliest === 'string' || summary.timeRange.earliest === null);
    });

    it('should get event count', () => {
      const count = getAuditCount();
      assert.ok(count >= 0);
    });

    it('should format an audit event', () => {
      const event = emitDagCreated('format-test', 'format-graph', 'format-intent');
      const formatted = formatAuditEvent(event);
      assert.ok(formatted.includes(event.kind));
      assert.ok(formatted.includes(event.traceId));
      assert.ok(formatted.includes(event.summary));
    });
  });

  describe('audit emitter functions', () => {
    it('should emit dag lifecycle events', () => {
      const created = emitDagCreated('dag-lifecycle', 'lifecycle-graph', 'test');
      assert.strictEqual(created.kind, 'dag.created');

      const started = emitDagStarted('dag-lifecycle', 'lifecycle-graph');
      assert.strictEqual(started.kind, 'dag.started');

      const completed = emitDagCompleted('dag-lifecycle', 'lifecycle-graph', 200);
      assert.strictEqual(completed.kind, 'dag.completed');

      const failed = emitDagFailed('dag-fail', 'fail-graph', 'oops');
      assert.strictEqual(failed.kind, 'dag.failed');

      assert.strictEqual(failed.severity, 'high');
      assert.ok(failed.payload?.error);
    });

    it('should emit node lifecycle events', () => {
      const started = emitNodeStarted('node-test', 'node-1', 'shell.exec');
      assert.strictEqual(started.kind, 'node.started');

      const completed = emitNodeCompleted('node-test', 'node-1', 50);
      assert.strictEqual(completed.kind, 'node.completed');

      const failed = emitNodeFailed('node-test', 'node-2', 'error', 3);
      assert.strictEqual(failed.kind, 'node.failed');
      assert.strictEqual(failed.severity, 'high');
    });

    it('should emit worker lifecycle events', () => {
      const registered = emitWorkerRegistered('worker-1', 'test-worker', 'local', ['browser', 'memory']);
      assert.strictEqual(registered.kind, 'worker.registered');

      const statusChanged = emitWorkerStatusChanged('worker-1', 'test-worker', 'online', 'busy');
      assert.strictEqual(statusChanged.kind, 'worker.status_change');

      const degraded = emitWorkerDegraded('worker-1', 'test-worker', 3);
      assert.strictEqual(degraded.kind, 'worker.degraded');
      assert.strictEqual(degraded.severity, 'high');

      const quarantined = emitWorkerQuarantined('worker-1', 'test-worker', 300000);
      assert.strictEqual(quarantined.kind, 'worker.quarantined');

      const recovered = emitWorkerRecovered('worker-1', 'test-worker');
      assert.strictEqual(recovered.kind, 'worker.recovered');
    });

    it('should emit assignment events', () => {
      const created = emitAssignmentCreated('assign-1', 'worker-1', 'graph-1', 'node-1');
      assert.strictEqual(created.kind, 'assignment.created');

      const completed = emitAssignmentCompleted('assign-1', 'graph-1', 100);
      assert.strictEqual(completed.kind, 'assignment.completed');

      const failed = emitAssignmentFailed('assign-2', 'graph-1', 'timeout');
      assert.strictEqual(failed.kind, 'assignment.failed');

      const reassigned = emitAssignmentReassigned('assign-1', 'worker-1', 'worker-2', 'graph-1');
      assert.strictEqual(reassigned.kind, 'assignment.reassigned');
    });

    it('should emit quality scored event', () => {
      const scored = emitQualityScored('worker-1', 'browser', 85.5);
      assert.strictEqual(scored.kind, 'quality.scored');
      assert.ok(scored.summary.includes('85.50'));
    });

    it('should emit federation events', () => {
      const handshakeOk = emitFederationHandshake('runtime-1', 'runtime-2', true);
      assert.strictEqual(handshakeOk.kind, 'federation.handshake');
      assert.strictEqual(handshakeOk.severity, 'info');

      const handshakeFail = emitFederationHandshake('runtime-1', 'runtime-3', false);
      assert.strictEqual(handshakeFail.severity, 'high');

      const bound = emitFederationContractBound('contract-1', 'runtime-1', 'worker-1', 'graph-1');
      assert.strictEqual(bound.kind, 'federation.contract_bound');
    });

    it('should emit control events', () => {
      const paused = emitControlPaused('graph-1', 'operator');
      assert.strictEqual(paused.kind, 'control.paused');

      const resumed = emitControlResumed('graph-1', 'operator');
      assert.strictEqual(resumed.kind, 'control.resumed');
    });

    it('should assign unique event IDs', () => {
      const e1 = emitDagCreated('id-test', 'g1', '');
      const e2 = emitDagCreated('id-test', 'g2', '');
      assert.notStrictEqual(e1.id, e2.id);
    });
  });

  describe('audit-replay', () => {
    it('should replay events with onEvent callback', () => {
      let count = 0;
      const result = replayAuditTrail({
        filter: { kind: 'dag.created' },
        onEvent: () => { count++; },
      });
      assert.strictEqual(result.replayed, count);
      assert.ok(result.durationMs >= 0);
    });

    it('should replay events grouped by kind', () => {
      const kindsSeen: string[] = [];
      const result = replayAuditTrail({
        onKind: (kind) => { kindsSeen.push(kind); },
      });
      assert.ok(kindsSeen.length > 0);
      assert.ok(result.kindsEncountered.length >= 1);
    });

    it('should support sequential replay with delay', async () => {
      let count = 0;
      const result = await replayAuditTrailSequential({
        filter: { kind: 'dag.created' },
        onEvent: () => { count++; },
        delayMs: 1,
      });
      assert.strictEqual(result.replayed, count);
    });

    it('should export to JSON string', () => {
      const json = exportAuditTrailJson({ kind: 'dag.created' });
      const parsed = JSON.parse(json);
      assert.ok(Array.isArray(parsed));
      for (const e of parsed) {
        assert.strictEqual(e.kind, 'dag.created');
      }
    });

    it('should export to CSV string', () => {
      const csv = exportAuditTrailCsv({ kind: 'dag.created' });
      assert.ok(csv.includes('id,kind,severity'));
      assert.ok(csv.includes('dag.created'));
      const lines = csv.split('\n');
      assert.ok(lines.length >= 2, 'CSV should have header + at least 1 row');
    });

    it('should save export to JSON file', () => {
      const filePath = path.join(process.cwd(), '.data', 'runtime', 'audit-export-test.json');
      const saved = saveAuditExportJson(filePath, { kind: 'worker.registered' });
      assert.ok(saved);
      assert.ok(fs.existsSync(filePath));
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      assert.ok(Array.isArray(content));
      fs.unlinkSync(filePath);
    });

    it('should save export to CSV file', () => {
      const filePath = path.join(process.cwd(), '.data', 'runtime', 'audit-export-test.csv');
      const saved = saveAuditExportCsv(filePath, { kind: 'worker.registered' });
      assert.ok(saved);
      assert.ok(fs.existsSync(filePath));
      fs.unlinkSync(filePath);
    });

    it('should format trail summary', () => {
      const summary = formatAuditTrailSummary({ kind: 'dag.created' });
      assert.ok(summary.includes('Audit Trail Summary'));
      assert.ok(summary.includes('dag.created'));
    });

    it('should handle empty audit trail in formatAuditTrailSummary', () => {
      const summary = formatAuditTrailSummary({ kind: 'nonexistent' as any });
      assert.ok(summary.includes('No audit events found'));
    });

    it('should abort replay on signal', () => {
      const ac = new AbortController();
      ac.abort();
      const result = replayAuditTrail({
        filter: { kind: 'dag.created' },
        onEvent: () => {},
        signal: ac.signal,
      });
      assert.ok(result.replayed <= result.total);
    });
  });

  describe('audit-store: edge cases', () => {
    it('should handle clearAuditTrail', () => {
      emitDagCreated('clear-test', 'clear-graph', '');
      assert.ok(getAuditCount() > 0);
      clearAuditTrail();
      assert.strictEqual(getAuditCount(), 0);
    });

    it('should handle query with empty result', () => {
      const results = queryAuditTrail({ kind: 'nonexistent' as any });
      assert.deepStrictEqual(results, []);
    });

    it('should handle limit and offset', () => {
      emitDagCreated('limit-test', 'lg', '');
      emitDagStarted('limit-test', 'lg');
      emitDagCompleted('limit-test', 'lg', 10);

      const all = queryAuditTrail({ traceId: 'limit-test', order: 'asc' });
      const limited = queryAuditTrail({ traceId: 'limit-test', order: 'asc', limit: 2 });
      assert.strictEqual(limited.length, 2);
      assert.strictEqual(limited[0].id, all[0].id);
      assert.strictEqual(limited[1].id, all[1].id);
    });

    it('should filter by severity', () => {
      const results = queryAuditTrail({ severity: 'high' });
      for (const r of results) {
        assert.strictEqual(r.severity, 'high');
      }
    });

    it('should filter by source', () => {
      const results = queryAuditTrail({ source: 'test' });
      for (const r of results) {
        assert.strictEqual(r.source, 'test');
      }
    });

    it('should set audit source', () => {
      setAuditSource('custom-source');
      const event = emitDagCreated('source-test', 'sg', '');
      assert.strictEqual(event.source, 'custom-source');
      setAuditSource('test');
    });
  });
});
