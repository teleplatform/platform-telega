export interface EvidenceSyncRetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBackoff: boolean;
  jitter: boolean;
  retryableStatuses: ('failed' | 'pending' | 'expired')[];
}

export const DEFAULT_SYNC_RETRY_POLICY: EvidenceSyncRetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 5000,
  maxDelayMs: 30000,
  exponentialBackoff: true,
  jitter: true,
  retryableStatuses: ['failed', 'pending'],
};

export interface SyncRetryResult {
  shouldRetry: boolean;
  nextDelayMs: number;
  attempt: number;
  lastError?: string;
}

export interface EvidenceSyncRetry {
  pendingSync: EvidenceSyncStatus[];
  policy: EvidenceSyncRetryPolicy;
  attemptSync: (envelopeId: string) => Promise<boolean>;
}

export class EvidenceSyncRetryEngine {
  private pendingSync: EvidenceSyncStatus[] = [];
  private policy: EvidenceSyncRetryPolicy;
  private attemptSync: (envelopeId: string) => Promise<boolean>;
  private lastAttemptMap: Map<string, number> = new Map();

  constructor(
    getPendingSync: () => EvidenceSyncStatus[],
    attemptSync: (envelopeId: string) => Promise<boolean>,
    policy: EvidenceSyncRetryPolicy = DEFAULT_SYNC_RETRY_POLICY
  ) {
    this.policy = policy;
    this.pendingSync = getPendingSync();
    this.attemptSync = attemptSync;
  }

  async processSync(): Promise<SyncRetryResult[]> {
    const results: SyncRetryResult[] = [];
    const now = Date.now();

    for (const syncStatus of this.pendingSync) {
      // Skip if recently attempted
      const lastAttempt = this.lastAttemptMap.get(syncStatus.envelopeId);
      if (lastAttempt && (now - lastAttempt) < 1000) {
        results.push({
          shouldRetry: false,
          nextDelayMs: 0,
          attempt: 0,
        });
        continue;
      }

      // Check if retry is needed
      const retryResult = this.shouldRetrySync(syncStatus);
      if (!retryResult.shouldRetry) {
        results.push({
          shouldRetry: false,
          nextDelayMs: 0,
          attempt: 0,
        });
        continue;
      }

      // Attempt sync
      const success = await this.attemptSync(syncStatus.envelopeId);
      this.lastAttemptMap.set(syncStatus.envelopeId, now);

      results.push({
        shouldRetry: !success && syncStatus.retryCount < this.policy.maxRetries,
        nextDelayMs: success ? 0 : this.calculateDelay(syncStatus.retryCount),
        attempt: syncStatus.attempts,
        lastError: success ? undefined : 'Sync failed',
      });
    }

    return results;
  }

  private shouldRetrySync(syncStatus: EvidenceSyncStatus): SyncRetryResult {
    // Check if status is retryable
    if (!this.policy.retryableStatuses.includes(syncStatus.status)) {
      return { shouldRetry: false, nextDelayMs: 0, attempt: 0 };
    }

    // Check if max retries reached
    if (syncStatus.retryCount >= this.policy.maxRetries) {
      return { shouldRetry: false, nextDelayMs: 0, attempt: 0 };
    }

    // Check if expired
    if (syncStatus.status === 'expired') {
      return { shouldRetry: false, nextDelayMs: 0, attempt: 0 };
    }

    return {
      shouldRetry: true,
      nextDelayMs: this.calculateDelay(syncStatus.retryCount),
      attempt: syncStatus.retryCount,
    };
  }

  private calculateDelay(attempt: number): number {
    let delay = this.policy.baseDelayMs;

    if (this.policy.exponentialBackoff) {
      delay = Math.min(
        this.policy.baseDelayMs * Math.pow(2, attempt),
        this.policy.maxDelayMs
      );
    }

    if (this.policy.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.round(delay);
  }

  markSuccess(envelopeId: string): void {
    this.lastAttemptMap.set(envelopeId, Date.now());
  }

  markFailure(envelopeId: string, retryCount: number): void {
    this.lastAttemptMap.set(envelopeId, Date.now());
    // Update retry count
    for (const sync of this.pendingSync) {
      if (sync.envelopeId === envelopeId) {
        sync.retryCount = retryCount + 1;
        sync.attempts++;
        break;
      }
    }
  }
}

function hashPayload(payload: any): string {
  return createContentHash(JSON.stringify(payload));
}

function createContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}