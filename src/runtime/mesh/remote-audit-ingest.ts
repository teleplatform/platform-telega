export interface RemoteAuditRequest {
  auditEvent: AuditEvent;
  originNodeId: string;
  syncToken: string;
  timestamp: number;
}

export interface RemoteAuditResponse {
  ok: boolean;
  status: 'accepted' | 'rejected' | 'duplicate';
  eventId: string;
  error?: string;
}

export class RemoteAuditIngestService {
  private auditEventStore: AuditEventStore;
  private processedEvents: Set<string> = new Set();

  constructor(auditEventStore: AuditEventStore) {
    this.auditEventStore = auditEventStore;
  }

  async ingestAudit(request: RemoteAuditRequest): Promise<RemoteAuditResponse> {
    // Check for duplicates
    if (this.processedEvents.has(request.auditEvent.id)) {
      return {
        ok: true,
        status: 'duplicate',
        eventId: request.auditEvent.id,
      };
    }

    // Validate audit event
    const validationError = this.validateAuditEvent(request.auditEvent);
    if (validationError) {
      return {
        ok: false,
        status: 'rejected',
        eventId: request.auditEvent.id,
        error: validationError,
      };
    }

    // Store the audit event
    this.auditEventStore.addEvent(request.auditEvent);
    this.processedEvents.add(request.auditEvent.id);

    return {
      ok: true,
      status: 'accepted',
      eventId: request.auditEvent.id,
    };
  }

  private validateAuditEvent(event: AuditEvent): string | null {
    if (!event.id) return 'Missing event ID';
    if (!event.eventType) return 'Missing event type';
    if (!event.action) return 'Missing action';
    if (!event.nodeId) return 'Missing node ID';
    if (!event.timestamp) return 'Missing timestamp';
    return null;
  }

  clearProcessedEvents(): void {
    this.processedEvents.clear();
  }

  getProcessedCount(): number {
    return this.processedEvents.size;
  }
}