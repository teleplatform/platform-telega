export interface RemoteEvidenceRequest {
  envelope: EvidenceEnvelope;
  origin: EvidenceOrigin;
  syncToken: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface RemoteEvidenceResponse {
  ok: boolean;
  status: 'verified' | 'rejected' | 'duplicate' | 'expired' | 'failed';
  envelopeId: string;
  verificationResult?: EvidenceIntegrityCheck;
  error?: string;
  retryable: boolean;
  nextRetryMs?: number;
}

export interface EvidenceIngestConfig {
  maxPayloadSizeBytes: number;
  allowedEvidenceTypes: string[];
  requireSignature: boolean;
  deduplicationWindowMs: number;
  verificationTimeoutMs: number;
}

export const DEFAULT_INGEST_CONFIG: EvidenceIngestConfig = {
  maxPayloadSizeBytes: 1024 * 1024, // 1MB
  allowedEvidenceTypes: ['execution', 'worker', 'network', 'storage', 'system'],
  requireSignature: true,
  deduplicationWindowMs: 5 * 60 * 1000, // 5 minutes
  verificationTimeoutMs: 30000,
};

export class EvidenceIngestService {
  private verifiedEvidence: Map<string, EvidenceEnvelope> = new Map();
  private syncStatusStore: EvidenceSyncStore;
  private config: EvidenceIngestConfig;

  constructor(config: EvidenceIngestConfig = DEFAULT_INGEST_CONFIG) {
    this.config = config;
    this.syncStatusStore = new InMemoryEvidenceSyncStore();
  }

  async ingestEvidence(request: RemoteEvidenceRequest): Promise<RemoteEvidenceResponse> {
    // 1. Validate request
    const validation = this.validateRequest(request);
    if (!validation.valid) {
      return {
        ok: false,
        status: 'rejected',
        envelopeId: request.envelope.id,
        error: validation.error,
        retryable: false,
        nextRetryMs: undefined,
      };
    }

    // 2. Check for duplicates
    const isDuplicate = this.isDuplicateEvidence(request.envelope);
    if (isDuplicate) {
      return {
        ok: true,
        status: 'duplicate',
        envelopeId: request.envelope.id,
        retryable: false,
        nextRetryMs: undefined,
      };
    }

    // 3. Verify integrity
    const integrityCheck = this.verifyEvidenceIntegrity(request.envelope, request.origin);
    if (!integrityCheck.valid) {
      return {
        ok: false,
        status: 'rejected',
        envelopeId: request.envelope.id,
        verificationResult: integrityCheck,
        error: 'Evidence integrity check failed',
        retryable: false,
        nextRetryMs: undefined,
      };
    }

    // 4. Store evidence
    this.storeEvidence(request.envelope);

    // 5. Update sync status
    this.updateSyncStatus(request.envelope.id, 'verified', request.origin.nodeId);

    return {
      ok: true,
      status: 'verified',
      envelopeId: request.envelope.id,
      verificationResult: integrityCheck,
      retryable: false,
      nextRetryMs: undefined,
    };
  }

  private validateRequest(request: RemoteEvidenceRequest): { valid: boolean; error?: string } {
    const envelope = request.envelope;

    // Check payload size
    const payloadSize = JSON.stringify(envelope.payload).length;
    if (payloadSize > this.config.maxPayloadSizeBytes) {
      return { valid: false, error: `Payload too large: ${payloadSize} bytes` };
    }

    // Check evidence type
    if (!this.config.allowedEvidenceTypes.includes(envelope.evidenceType)) {
      return { valid: false, error: `Evidence type ${envelope.evidenceType} not allowed` };
    }

    // Check signature if required
    if (this.config.requireSignature && !envelope.signature) {
      return { valid: false, error: 'Signature required but missing' };
    }

    // Check expiration
    if (isEvidenceExpired(envelope)) {
      return { valid: false, error: 'Evidence expired' };
    }

    return { valid: true };
  }

  private isDuplicateEvidence(envelope: EvidenceEnvelope): boolean {
    const now = Date.now();
    const deduplicationWindowMs = this.config.deduplicationWindowMs;

    // Check if we have already verified similar evidence
    for (const [id, verified] of this.verifiedEvidence) {
      if (verified.evidenceType === envelope.evidenceType &&
          verified.assignmentId === envelope.assignmentId &&
          verified.originNode === envelope.originNode &&
          Math.abs(verified.timestamp - envelope.timestamp) < deduplicationWindowMs) {
        return true;
      }
    }

    return false;
  }

  private verifyEvidenceIntegrity(
    envelope: EvidenceEnvelope,
    origin: EvidenceOrigin
  ): EvidenceIntegrityCheck {
    // Simplified verification - in production this would use proper crypto
    const payloadHash = hashPayload(envelope.payload);
    const expectedSignature = createExpectedSignature(payloadHash, origin.nodeId);
    const signatureValid = envelope.signature === expectedSignature;

    return {
      envelopeId: envelope.id,
      payloadHash,
      signature: envelope.signature,
      verifiedAt: Date.now(),
      verifiedBy: origin.nodeId,
      valid: signatureValid,
      verificationMethod: 'hmac_verification',
    };
  }

  private storeEvidence(envelope: EvidenceEnvelope): void {
    this.verifiedEvidence.set(envelope.id, envelope);
  }

  private updateSyncStatus(envelopeId: string, status: EvidenceSyncStatus['status'], nodeId: string): void {
    const current = this.syncStatusStore.get(envelopeId);
    if (current) {
      this.syncStatusStore.update(envelopeId, {
        status,
        lastSuccessAt: Date.now(),
        attempts: current.attempts + 1,
      });
    } else {
      this.syncStatusStore.set(envelopeId, {
        envelopeId,
        status,
        nodeId,
        attempts: 1,
        lastAttemptAt: Date.now(),
        lastSuccessAt: Date.now(),
        retryCount: 0,
        syncToken: Date.now().toString(),
      });
    }
  }

  getSyncStatus(envelopeId: string): EvidenceSyncStatus | undefined {
    return this.syncStatusStore.get(envelopeId);
  }

  getVerifiedEvidenceByAssignment(assignmentId: string): EvidenceEnvelope[] {
    const evidence: EvidenceEnvelope[] = [];
    for (const [id, verified] of this.verifiedEvidence) {
      if (verified.assignmentId === assignmentId) {
        evidence.push(verified);
      }
    }
    return evidence;
  }

  cleanupExpiredEvidence(now: number): void {
    const maxEvidenceAgeMs = 30 * 24 * 60 * 60 * 1000; // 30 days
    for (const [id, evidence] of this.verifiedEvidence) {
      if (now - evidence.timestamp > maxEvidenceAgeMs) {
        this.verifiedEvidence.delete(id);
      }
    }
  }
}

function hashPayload(payload: any): string {
  return createContentHash(JSON.stringify(payload));
}

function createExpectedSignature(payloadHash: string, nodeId: string): string {
  return `${payloadHash}_${nodeId}_verified`;
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

function isEvidenceExpired(envelope: EvidenceEnvelope, now: number = Date.now()): boolean {
  return envelope.expiresAt < now;
}