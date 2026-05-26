import fs from 'node:fs';
import path from 'node:path';
import type { AuditEvent, AuditEventKind, AuditFilter, AuditSeverity, AuditSummary } from './audit-types.js';

const STORE_PATH = path.join(process.cwd(), '.data', 'runtime', 'audit.jsonl');

const eventCache: AuditEvent[] = [];
let cacheLoaded = false;

function loadEvents(): void {
  if (cacheLoaded) return;
  if (!fs.existsSync(STORE_PATH)) {
    cacheLoaded = true;
    return;
  }
  eventCache.length = 0;
  try {
    const content = fs.readFileSync(STORE_PATH, 'utf8');
    for (const line of content.split('\n').filter(Boolean)) {
      try {
        eventCache.push(JSON.parse(line) as AuditEvent);
      } catch { }
    }
  } catch { }
  cacheLoaded = true;
}

function appendToFile(event: AuditEvent): void {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(STORE_PATH, JSON.stringify(event) + '\n', 'utf8');
  } catch { }
}

let eventCounter = 0;

export function nextAuditId(): string {
  eventCounter++;
  return `audit_${Date.now()}_${eventCounter}`;
}

export function appendAuditEvent(event: Omit<AuditEvent, 'id'> & { id?: string }): AuditEvent {
  const full: AuditEvent = {
    id: event.id || nextAuditId(),
    kind: event.kind,
    severity: event.severity,
    timestamp: event.timestamp,
    traceId: event.traceId,
    source: event.source,
    actor: event.actor,
    summary: event.summary,
    payload: event.payload,
  };
  eventCache.push(full);
  appendToFile(full);
  return full;
}

export function queryAuditTrail(filter?: AuditFilter): AuditEvent[] {
  loadEvents();
  let results = eventCache;
  if (!filter) return [...results];
  if (filter.kind) results = results.filter(e => e.kind === filter.kind);
  if (filter.kinds) results = results.filter(e => filter.kinds!.includes(e.kind));
  if (filter.traceId) results = results.filter(e => e.traceId === filter.traceId);
  if (filter.source) results = results.filter(e => e.source === filter.source);
  if (filter.actor) results = results.filter(e => e.actor === filter.actor);
  if (filter.severity) {
    const sevs = Array.isArray(filter.severity) ? filter.severity : [filter.severity];
    results = results.filter(e => sevs.includes(e.severity));
  }
  if (filter.since) results = results.filter(e => e.timestamp >= filter.since!);
  if (filter.until) results = results.filter(e => e.timestamp <= filter.until!);
  if (filter.summary) {
    const term = filter.summary.toLowerCase();
    results = results.filter(e => e.summary.toLowerCase().includes(term));
  }

  if (filter.order === 'asc') {
    results.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  } else {
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  const offset = filter.offset || 0;
  const limit = filter.limit || results.length;
  return results.slice(offset, offset + limit);
}

export function getAuditEvent(id: string): AuditEvent | undefined {
  loadEvents();
  return eventCache.find(e => e.id === id);
}

export function getAuditTrailByTrace(traceId: string): AuditEvent[] {
  return queryAuditTrail({ traceId, order: 'asc' });
}

export function getAuditSummary(): AuditSummary {
  loadEvents();
  const byKind: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const traces = new Set<string>();
  const actors = new Set<string>();
  let earliest: string | null = null;
  let latest: string | null = null;

  for (const e of eventCache) {
    byKind[e.kind] = (byKind[e.kind] || 0) + 1;
    bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
    bySource[e.source] = (bySource[e.source] || 0) + 1;
    traces.add(e.traceId);
    actors.add(e.actor);
    if (!earliest || e.timestamp < earliest) earliest = e.timestamp;
    if (!latest || e.timestamp > latest) latest = e.timestamp;
  }

  return {
    totalEvents: eventCache.length,
    byKind, bySeverity, bySource,
    timeRange: { earliest, latest },
    uniqueTraces: traces.size,
    uniqueActors: actors.size,
  };
}

export function getAuditCount(): number {
  loadEvents();
  return eventCache.length;
}

export function clearAuditTrail(): void {
  eventCache.length = 0;
  try {
    if (fs.existsSync(STORE_PATH)) fs.unlinkSync(STORE_PATH);
  } catch { }
}

export function formatAuditEvent(event: AuditEvent): string {
  const lines: string[] = [
    `[${event.timestamp}] ${event.kind} (${event.severity})`,
    `  traceId: ${event.traceId}`,
    `  source: ${event.source} | actor: ${event.actor}`,
    `  summary: ${event.summary}`,
  ];
  if (event.payload && Object.keys(event.payload).length > 0) {
    lines.push(`  payload: ${JSON.stringify(event.payload)}`);
  }
  return lines.join('\n');
}

let auditSource = 'audit';
export function setAuditSource(source: string): void {
  auditSource = source;
}

function emit(kind: AuditEventKind, severity: AuditSeverity, traceId: string, actor: string, summary: string, payload?: Record<string, unknown>): AuditEvent {
  return appendAuditEvent({
    kind, severity,
    timestamp: new Date().toISOString(),
    traceId, source: auditSource, actor, summary, payload,
  });
}

export function emitDagCreated(traceId: string, name: string, intent: string): AuditEvent {
  return emit('dag.created', 'info', traceId, 'system', `DAG created: ${name}`, { name, intent });
}

export function emitDagStarted(traceId: string, name: string): AuditEvent {
  return emit('dag.started', 'info', traceId, 'system', `DAG started: ${name}`, { name });
}

export function emitDagCompleted(traceId: string, name: string, durationMs: number): AuditEvent {
  return emit('dag.completed', 'info', traceId, 'system', `DAG completed: ${name}`, { name, durationMs });
}

export function emitDagFailed(traceId: string, name: string, error: string): AuditEvent {
  return emit('dag.failed', 'high', traceId, 'system', `DAG failed: ${name}`, { name, error });
}

export function emitDagCancelled(traceId: string, name: string): AuditEvent {
  return emit('dag.cancelled', 'medium', traceId, 'system', `DAG cancelled: ${name}`, { name });
}

export function emitNodeStarted(traceId: string, nodeId: string, taskType: string): AuditEvent {
  return emit('node.started', 'info', traceId, 'system', `Node started: ${nodeId} (${taskType})`, { nodeId, taskType });
}

export function emitNodeCompleted(traceId: string, nodeId: string, durationMs: number): AuditEvent {
  return emit('node.completed', 'info', traceId, 'system', `Node completed: ${nodeId}`, { nodeId, durationMs });
}

export function emitNodeFailed(traceId: string, nodeId: string, error: string, retryCount: number): AuditEvent {
  return emit('node.failed', 'high', traceId, 'system', `Node failed: ${nodeId} after ${retryCount} retries`, { nodeId, error, retryCount });
}

export function emitNodeSkipped(traceId: string, nodeId: string, reason: string): AuditEvent {
  return emit('node.skipped', 'low', traceId, 'system', `Node skipped: ${nodeId}`, { nodeId, reason });
}

export function emitNodeRetried(traceId: string, nodeId: string, attempt: number, error: string): AuditEvent {
  return emit('node.retried', 'medium', traceId, 'system', `Node retried: ${nodeId} attempt ${attempt}`, { nodeId, attempt, error });
}

export function emitWorkerRegistered(workerId: string, name: string, kind: string, capabilities: string[]): AuditEvent {
  return emit('worker.registered', 'info', workerId, workerId, `Worker registered: ${name} (${kind})`, { workerId, name, kind, capabilities });
}

export function emitWorkerUnregistered(workerId: string, name: string): AuditEvent {
  return emit('worker.unregistered', 'info', workerId, workerId, `Worker unregistered: ${name}`, { workerId, name });
}

export function emitWorkerStatusChanged(workerId: string, name: string, oldStatus: string, newStatus: string): AuditEvent {
  return emit('worker.status_change', 'medium', workerId, workerId, `Worker status: ${name} ${oldStatus} → ${newStatus}`, { workerId, name, oldStatus, newStatus });
}

export function emitWorkerDegraded(workerId: string, name: string, consecutiveFailures: number): AuditEvent {
  return emit('worker.degraded', 'high', workerId, workerId, `Worker degraded: ${name} (${consecutiveFailures} consecutive failures)`, { workerId, name, consecutiveFailures });
}

export function emitWorkerQuarantined(workerId: string, name: string, quarantineDuration: number): AuditEvent {
  return emit('worker.quarantined', 'high', workerId, workerId, `Worker quarantined: ${name} for ${quarantineDuration}ms`, { workerId, name, quarantineDuration });
}

export function emitWorkerRecovered(workerId: string, name: string): AuditEvent {
  return emit('worker.recovered', 'info', workerId, workerId, `Worker recovered: ${name}`, { workerId, name });
}

export function emitAssignmentCreated(assignmentId: string, workerId: string, graphId: string, nodeId: string): AuditEvent {
  return emit('assignment.created', 'info', graphId, workerId, `Assignment created: ${assignmentId} for node ${nodeId}`, { assignmentId, workerId, graphId, nodeId });
}

export function emitAssignmentStarted(assignmentId: string, graphId: string): AuditEvent {
  return emit('assignment.started', 'info', graphId, assignmentId, `Assignment started: ${assignmentId}`, { assignmentId, graphId });
}

export function emitAssignmentCompleted(assignmentId: string, graphId: string, durationMs: number): AuditEvent {
  return emit('assignment.completed', 'info', graphId, assignmentId, `Assignment completed: ${assignmentId}`, { assignmentId, graphId, durationMs });
}

export function emitAssignmentFailed(assignmentId: string, graphId: string, error: string): AuditEvent {
  return emit('assignment.failed', 'high', graphId, assignmentId, `Assignment failed: ${assignmentId}`, { assignmentId, graphId, error });
}

export function emitAssignmentReassigned(assignmentId: string, fromWorkerId: string, toWorkerId: string, graphId: string): AuditEvent {
  return emit('assignment.reassigned', 'medium', graphId, toWorkerId, `Assignment reassigned: ${assignmentId} from ${fromWorkerId} to ${toWorkerId}`, { assignmentId, fromWorkerId, toWorkerId, graphId });
}

export function emitQualityScored(workerId: string, capability: string, score: number): AuditEvent {
  return emit('quality.scored', 'info', workerId, workerId, `Quality scored: ${workerId} ${capability} = ${score.toFixed(2)}`, { workerId, capability, score });
}

export function emitFederationHandshake(runtimeId: string, remoteRuntimeId: string, success: boolean): AuditEvent {
  return emit('federation.handshake', success ? 'info' : 'high', runtimeId, runtimeId, `Federation handshake ${success ? 'succeeded' : 'failed'} with ${remoteRuntimeId}`, { runtimeId, remoteRuntimeId, success });
}

export function emitFederationContractBound(contractId: string, runtimeId: string, workerId: string, graphId: string): AuditEvent {
  return emit('federation.contract_bound', 'info', graphId, runtimeId, `Contract bound: ${contractId} to ${workerId}`, { contractId, runtimeId, workerId, graphId });
}

export function emitFederationPeerDiscovered(runtimeId: string, remoteRuntimeId: string, capabilities: string[]): AuditEvent {
  return emit('federation.peer_discovered', 'info', runtimeId, runtimeId, `Peer discovered: ${remoteRuntimeId}`, { runtimeId, remoteRuntimeId, capabilities });
}

export function emitFederationPeerLost(runtimeId: string, remoteRuntimeId: string): AuditEvent {
  return emit('federation.peer_lost', 'medium', runtimeId, runtimeId, `Peer lost: ${remoteRuntimeId}`, { runtimeId, remoteRuntimeId });
}

export function emitControlPaused(graphId: string, actor: string): AuditEvent {
  return emit('control.paused', 'medium', graphId, actor, `Graph paused: ${graphId}`, { graphId });
}

export function emitControlResumed(graphId: string, actor: string): AuditEvent {
  return emit('control.resumed', 'info', graphId, actor, `Graph resumed: ${graphId}`, { graphId });
}

export function emitControlCancelled(graphId: string, actor: string): AuditEvent {
  return emit('control.cancelled', 'medium', graphId, actor, `Graph cancelled: ${graphId}`, { graphId });
}

export function emitEvidenceRecorded(traceId: string, evidenceId: string, evidenceType: string): AuditEvent {
  return emit('evidence.recorded', 'info', traceId, 'system', `Evidence recorded: ${evidenceId} (${evidenceType})`, { evidenceId, evidenceType });
}

export function emitEvidenceVerified(traceId: string, evidenceId: string, valid: boolean): AuditEvent {
  return emit('evidence.verified', valid ? 'info' : 'high', traceId, 'system', `Evidence ${valid ? 'verified' : 'INVALID'}: ${evidenceId}`, { evidenceId, valid });
}
