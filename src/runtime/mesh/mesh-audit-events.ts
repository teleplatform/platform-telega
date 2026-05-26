export interface AuditEvent {
  id: string;
  eventType: 'assignment' | 'transport' | 'evidence' | 'worker' | 'node' | 'system';
  action: string;
  nodeId: string;
  assignmentId?: string;
  evidenceId?: string;
  workerId?: string;
  payload: any;
  timestamp: number;
  metadata: Record<string, unknown>;
  severity: 'info' | 'warn' | 'error' | 'critical';
  source: 'local' | 'remote' | 'system';
}

export interface AuditEventFilter {
  eventType?: string;
  action?: string;
  nodeId?: string;
  assignmentId?: string;
  evidenceId?: string;
  workerId?: string;
  severity?: string;
  since?: number;
  until?: number;
}

export interface AuditEventStats {
  total: number;
  byEventType: Record<string, number>;
  bySeverity: Record<string, number>;
  byNode: Record<string, number>;
  recentEvents: AuditEvent[];
}

export interface AuditEventStore {
  addEvent(event: AuditEvent): void;
  getEvent(id: string): AuditEvent | undefined;
  searchEvents(filter: AuditEventFilter): AuditEvent[];
  getStats(): AuditEventStats;
  cleanupExpired(now: number): void;
}

export class InMemoryAuditEventStore implements AuditEventStore {
  private events = new Map<string, AuditEvent>();
  private maxEvents = 10000;

  addEvent(event: AuditEvent): void {
    this.events.set(event.id, event);
    if (this.events.size > this.maxEvents) {
      const oldestKey = this.events.keys().next().value;
      this.events.delete(oldestKey);
    }
  }

  getEvent(id: string): AuditEvent | undefined {
    return this.events.get(id);
  }

  searchEvents(filter: AuditEventFilter): AuditEvent[] {
    let events = Array.from(this.events.values());

    if (filter.eventType) {
      events = events.filter(e => e.eventType === filter.eventType);
    }
    if (filter.action) {
      events = events.filter(e => e.action === filter.action);
    }
    if (filter.nodeId) {
      events = events.filter(e => e.nodeId === filter.nodeId);
    }
    if (filter.assignmentId) {
      events = events.filter(e => e.assignmentId === filter.assignmentId);
    }
    if (filter.evidenceId) {
      events = events.filter(e => e.evidenceId === filter.evidenceId);
    }
    if (filter.workerId) {
      events = events.filter(e => e.workerId === filter.workerId);
    }
    if (filter.severity) {
      events = events.filter(e => e.severity === filter.severity);
    }
    if (filter.since) {
      events = events.filter(e => e.timestamp >= filter.since);
    }
    if (filter.until) {
      events = events.filter(e => e.timestamp <= filter.until);
    }

    return events;
  }

  getStats(): AuditEventStats {
    const events = Array.from(this.events.values());
    const byEventType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byNode: Record<string, number> = {};

    for (const event of events) {
      byEventType[event.eventType] = (byEventType[event.eventType] || 0) + 1;
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
      byNode[event.nodeId] = (byNode[event.nodeId] || 0) + 1;
    }

    return {
      total: events.length,
      byEventType,
      bySeverity,
      byNode,
      recentEvents: events.slice(-10).reverse(),
    };
  }

  cleanupExpired(now: number): void {
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    for (const [id, event] of this.events.entries()) {
      if (event.timestamp < oneDayAgo) {
        this.events.delete(id);
      }
    }
  }
}

export function createAuditEvent(
  eventType: AuditEvent['eventType'],
  action: string,
  nodeId: string,
  payload: any,
  options: {
    assignmentId?: string;
    evidenceId?: string;
    workerId?: string;
    severity?: string;
    source?: string;
    metadata?: Record<string, unknown>;
  } = {}
): AuditEvent {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    eventType,
    action,
    nodeId,
    assignmentId: options.assignmentId,
    evidenceId: options.evidenceId,
    workerId: options.workerId,
    payload,
    timestamp: Date.now(),
    metadata: options.metadata || {},
    severity: options.severity || 'info',
    source: options.source || 'local',
  };
}