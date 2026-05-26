import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import {
  createAuditEvent,
  InMemoryAuditEventStore,
  AuditParentChildNode,
} from '../../../src/runtime/mesh/index.js';

describe('RC-54: Audit Linkage', () => {
  let auditStore: AuditParentChildNode;
  let auditEventStore: InMemoryAuditEventStore;

  before(() => {
    auditStore = new AuditParentChildNode();
    auditEventStore = new InMemoryAuditEventStore();
  });

  after(() => {
    // cleanup if needed
  });

  it('should create audit event', () => {
    const event = createAuditEvent(
      'assignment',
      'assign_task',
      'node-1',
      { taskId: 'task-123' },
      { assignmentId: 'assign-456', severity: 'info' }
    );

    assert.ok(event.id);
    assert.strictEqual(event.eventType, 'assignment');
    assert.strictEqual(event.action, 'assign_task');
    assert.strictEqual(event.nodeId, 'node-1');
    assert.strictEqual(event.assignmentId, 'assign-456');
  });

  it('should create audit trace', () => {
    const traceId = auditStore.createTrace({
      id: 'trace-1',
      nodeId: 'node-1',
      action: 'process_assignment',
      status: 'pending',
      timestamp: Date.now(),
      metadata: {}
    });

    assert.ok(traceId);
  });

  it('should add event to trace', () => {
    const traceId = auditStore.createTrace({
      id: 'trace-1',
      nodeId: 'node-1',
      action: 'process_assignment',
      status: 'pending',
      timestamp: Date.now(),
      metadata: {}
    });

    const event = {
      id: 'event-1',
      nodeId: 'node-1',
      action: 'subtask_start',
      status: 'running',
      timestamp: Date.now(),
      parentTraceId: traceId,
      metadata: {}
    };

    auditStore.addEvent(traceId, event);

    const trace = auditStore.getTrace(traceId);
    assert.ok(trace);
    const events = trace.metadata.events as string[] | undefined;
    assert.ok(events);
    assert.ok(events.includes('event-1'));
  });

  it('should get trace history', () => {
    const rootTraceId = auditStore.createTrace({
      id: 'root-trace',
      nodeId: 'node-1',
      action: 'root_action',
      status: 'completed',
      timestamp: Date.now(),
      metadata: {}
    });

    const childTraceId = auditStore.createTrace({
      id: 'child-trace',
      nodeId: 'node-2',
      action: 'child_action',
      status: 'completed',
      timestamp: Date.now() + 1000,
      parentTraceId: rootTraceId,
      metadata: {}
    });

    auditStore.addEvent(rootTraceId, {
      id: 'child-trace',
      nodeId: 'node-2',
      action: 'child_action',
      status: 'completed',
      timestamp: Date.now() + 1000,
      parentTraceId: rootTraceId,
      metadata: {}
    });

    const history = auditStore.getTraceHistory(childTraceId);
    assert.strictEqual(history.length, 2);
    assert.strictEqual(history[0].id, 'root-trace');
    assert.strictEqual(history[1].id, 'child-trace');
  });
});