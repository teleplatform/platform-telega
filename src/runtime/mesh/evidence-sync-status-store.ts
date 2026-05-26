export interface EvidenceSyncStatus {
  envelopeId: string;
  status: 'pending' | 'received' | 'verified' | 'stored' | 'synced' | 'failed' | 'expired';
  nodeId: string;
  attempts: number;
  lastAttemptAt: number;
  lastSuccessAt: number;
  error?: string;
  retryCount: number;
  syncToken: string;
}

export interface EvidenceSyncStore {
  get(envelopeId: string): EvidenceSyncStatus | undefined;
  set(envelopeId: string, status: EvidenceSyncStatus): void;
  update(envelopeId: string, updates: Partial<EvidenceSyncStatus>): void;
  incrementAttempts(envelopeId: string): void;
  getPendingSync(): EvidenceSyncStatus[];
  cleanupExpired(now: number): void;
}

export class InMemoryEvidenceSyncStore implements EvidenceSyncStore {
  private store = new Map<string, EvidenceSyncStatus>();

  get(envelopeId: string): EvidenceSyncStatus | undefined {
    return this.store.get(envelopeId);
  }

  set(envelopeId: string, status: EvidenceSyncStatus): void {
    this.store.set(envelopeId, status);
  }

  update(envelopeId: string, updates: Partial<EvidenceSyncStatus>): void {
    const current = this.store.get(envelopeId);
    if (current) {
      this.store.set(envelopeId, { ...current, ...updates });
    }
  }

  incrementAttempts(envelopeId: string): void {
    const current = this.store.get(envelopeId);
    if (current) {
      this.store.set(envelopeId, {
        ...current,
        attempts: current.attempts + 1,
        lastAttemptAt: Date.now(),
      });
    }
  }

  getPendingSync(): EvidenceSyncStatus[] {
    const now = Date.now();
    return Array.from(this.store.values()).filter(
      (status) => status.status === 'pending' || status.status === 'received'
    );
  }

  cleanupExpired(now: number): void {
    for (const [envelopeId, status] of this.store.entries()) {
      if (status.status === 'expired' || status.lastAttemptAt < now - 24 * 60 * 60 * 1000) {
        this.store.delete(envelopeId);
      }
    }
  }
}