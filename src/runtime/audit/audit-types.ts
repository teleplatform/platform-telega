export type AuditEventKind =
  | 'dag.created'
  | 'dag.started'
  | 'dag.completed'
  | 'dag.failed'
  | 'dag.cancelled'
  | 'node.started'
  | 'node.completed'
  | 'node.failed'
  | 'node.skipped'
  | 'node.retried'
  | 'worker.registered'
  | 'worker.unregistered'
  | 'worker.status_change'
  | 'worker.degraded'
  | 'worker.quarantined'
  | 'worker.recovered'
  | 'assignment.created'
  | 'assignment.started'
  | 'assignment.completed'
  | 'assignment.failed'
  | 'assignment.reassigned'
  | 'quality.scored'
  | 'federation.handshake'
  | 'federation.contract_bound'
  | 'federation.peer_discovered'
  | 'federation.peer_lost'
  | 'control.paused'
  | 'control.resumed'
  | 'control.cancelled'
  | 'evidence.recorded'
  | 'evidence.verified';

export type AuditSeverity = 'low' | 'info' | 'medium' | 'high' | 'critical';

export interface AuditEvent {
  id: string;
  kind: AuditEventKind;
  severity: AuditSeverity;
  timestamp: string;
  traceId: string;
  source: string;
  actor: string;
  summary: string;
  payload?: Record<string, unknown>;
}

export interface AuditFilter {
  kind?: AuditEventKind;
  kinds?: AuditEventKind[];
  traceId?: string;
  source?: string;
  actor?: string;
  severity?: AuditSeverity | AuditSeverity[];
  since?: string;
  until?: string;
  summary?: string;
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
}

export interface AuditSummary {
  totalEvents: number;
  byKind: Record<string, number>;
  bySeverity: Record<string, number>;
  bySource: Record<string, number>;
  timeRange: { earliest: string | null; latest: string | null };
  uniqueTraces: number;
  uniqueActors: number;
}

export interface ReplayOptions {
  filter?: AuditFilter;
  onEvent?: (event: AuditEvent, index: number) => void | Promise<void>;
  onKind?: (kind: AuditEventKind, events: AuditEvent[]) => void | Promise<void>;
  delayMs?: number;
  signal?: AbortSignal;
}

export interface ReplayResult {
  total: number;
  replayed: number;
  durationMs: number;
  kindsEncountered: AuditEventKind[];
}
