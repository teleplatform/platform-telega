export interface AuditTrace {
  id: string;
  nodeId: string;
  action: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  timestamp: number;
  parentTraceId?: string;
  metadata: Record<string, unknown>;
}

export interface AuditTraceFilter {
  traceId?: string;
  nodeId?: string;
  action?: string;
  status?: AuditTrace['status'];
  since?: number;
  until?: number;
}

const MAX_TRACE_DEPTH = 32;

export class AuditParentChildNode {
  private traces = new Map<string, AuditTrace>();
  private expiredAt = Date.now() + 86400000;

  createTrace(trace: AuditTrace): string {
    this.traces.set(trace.id, trace);
    return trace.id;
  }

  addEvent(traceId: string, event: AuditTrace): void {
    const parent = this.traces.get(traceId);
    if (!parent) return;

    const depth = this.calculateTraceDepth(traceId);
    if (depth > MAX_TRACE_DEPTH) return;

    const child: AuditTrace = {
      ...event,
      parentTraceId: traceId,
    };

    this.traces.set(child.id, child);

    parent.metadata = {
      ...parent.metadata,
      events: [...((parent.metadata.events as string[]) || []), child.id],
    };
  }

  getTrace(traceId: string): AuditTrace | undefined {
    return this.traces.get(traceId);
  }

  getTraces(filter?: AuditTraceFilter): AuditTrace[] {
    let traces = [...this.traces.values()];

    if (filter?.traceId) traces = traces.filter((t) => t.id === filter.traceId);
    if (filter?.nodeId) traces = traces.filter((t) => t.nodeId === filter.nodeId);
    if (filter?.action) traces = traces.filter((t) => t.action === filter.action);
    if (filter?.status) traces = traces.filter((t) => t.status === filter.status);
    if (filter?.since) traces = traces.filter((t) => t.timestamp >= filter.since);
    if (filter?.until) traces = traces.filter((t) => t.timestamp <= filter.until);

    return traces.sort((a, b) => a.timestamp - b.timestamp);
  }

  findTracesByAction(action: string): AuditTrace[] {
    if (!action) return [];
    return [...this.traces.values()].filter((t) => t.action === action);
  }

  getTraceHistory(traceId: string): AuditTrace[] {
    const result: AuditTrace[] = [];
    let current = this.traces.get(traceId);

    while (current) {
      result.unshift(current);
      if (!current.parentTraceId) break;
      current = this.traces.get(current.parentTraceId);
    }

    return result;
  }

  cleanupExpired(now: number): void {
    if (now > this.expiredAt) {
      this.traces.clear();
      this.expiredAt = now + 86400000;
    }
  }

  private calculateTraceDepth(traceId: string): number {
    let depth = 0;
    let current = this.traces.get(traceId);

    while (current) {
      depth += 1;
      if (!current.parentTraceId) break;
      current = this.traces.get(current.parentTraceId);

      if (depth > MAX_TRACE_DEPTH) break;
    }

    return depth;
  }
}
