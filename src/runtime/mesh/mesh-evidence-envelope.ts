export interface EvidenceEnvelope {
  id: string;
  assignmentId: string;
  taskId: string;
  nodeId: string;
  originNode: string;
  evidenceType: 'execution' | 'worker' | 'network' | 'storage' | 'system';
  payload: any;
  signature: string;
  timestamp: number;
  expiresAt: number;
  metadata: Record<string, unknown>;
}

export interface EvidenceOrigin {
  nodeId: string;
  nodeName: string;
  nodeKind: string;
  version: string;
  capabilities: string[];
  timestamp: number;
  signature: string;
}

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

export interface EvidenceDeduplicationKey {
  assignmentId: string;
  evidenceType: string;
  originNode: string;
  timestamp: number;
}

export interface EvidenceIntegrityCheck {
  envelopeId: string;
  hash: string;
  signature: string;
  verifiedAt: number;
  verifiedBy: string;
  valid: boolean;
  chainOfTrust?: string[];
}

export interface EvidenceSyncRetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBackoff: boolean;
  jitter: boolean;
  retryableStatuses: ('failed' | 'pending' | 'expired')[];
}

export const DEFAULT_EVIDENCE_SYNC_POLICY: EvidenceSyncRetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 5000,
  maxDelayMs: 30000,
  exponentialBackoff: true,
  jitter: true,
  retryableStatuses: ['failed', 'pending', 'expired'],
};

export function createEvidenceEnvelope(
  assignmentId: string,
  taskId: string,
  nodeId: string,
  originNode: string,
  evidenceType: EvidenceEnvelope['evidenceType'],
  payload: any,
  signature: string,
  expiresAt: number,
  metadata: Record<string, unknown> = {}
): EvidenceEnvelope {
  return {
    id: `evidence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    assignmentId,
    taskId,
    nodeId,
    originNode,
    evidenceType,
    payload,
    signature,
    timestamp: Date.now(),
    expiresAt,
    metadata,
  };
}

export function createEvidenceOrigin(
  nodeId: string,
  nodeName: string,
  nodeKind: string,
  version: string,
  capabilities: string[],
  signature: string
): EvidenceOrigin {
  return {
    nodeId,
    nodeName,
    nodeKind,
    version,
    capabilities,
    timestamp: Date.now(),
    signature,
  };
}

export function createEvidenceSyncStatus(
  envelopeId: string,
  nodeId: string,
  syncToken: string
): EvidenceSyncStatus {
  return {
    envelopeId,
    status: 'pending',
    nodeId,
    attempts: 0,
    lastAttemptAt: 0,
    lastSuccessAt: 0,
    retryCount: 0,
    syncToken,
  };
}

export function isEvidenceExpired(envelope: EvidenceEnvelope, now: number = Date.now()): boolean {
  return envelope.expiresAt < now;
}

export function generateDeduplicationKey(
  envelope: EvidenceEnvelope
): EvidenceDeduplicationKey {
  return {
    assignmentId: envelope.assignmentId,
    evidenceType: envelope.evidenceType,
    originNode: envelope.originNode,
    timestamp: Math.floor(envelope.timestamp / 1000), // Round to nearest second
  };
}

export function verifyEvidenceIntegrity(
  envelope: EvidenceEnvelope,
  origin: EvidenceOrigin,
  publicKey: string
): EvidenceIntegrityCheck {
  // Simplified integrity check - in production this would verify signatures and hashes
  const contentHash = createContentHash(JSON.stringify(envelope.payload));
  const signatureValid = verifySignature(envelope.signature, contentHash, publicKey);
  
  return {
    envelopeId: envelope.id,
    hash: contentHash,
    signature: envelope.signature,
    verifiedAt: Date.now(),
    verifiedBy: origin.nodeId,
    valid: signatureValid,
    chainOfTrust: [origin.nodeId],
  };
}

export function shouldRetryEvidenceSync(
  status: EvidenceSyncStatus,
  policy: EvidenceSyncRetryPolicy = DEFAULT_EVIDENCE_SYNC_POLICY
): boolean {
  if (isEvidenceExpired(status)) return false;
  
  if (!policy.retryableStatuses.includes(status.status)) return false;
  
  return status.retryCount < policy.maxRetries;
}

export function calculateRetryDelay(
  retryCount: number,
  policy: EvidenceSyncRetryPolicy = DEFAULT_EVIDENCE_SYNC_POLICY
): number {
  const { baseDelayMs, maxDelayMs, exponentialBackoff, jitter } = policy;
  
  let delay = baseDelayMs;
  
  if (exponentialBackoff) {
    delay = Math.min(baseDelayMs * Math.pow(2, retryCount), maxDelayMs);
  }
  
  if (jitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }
  
  return Math.round(delay);
}

function createContentHash(content: string): string {
  // Simple hash for demonstration - in production use SHA-256
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

function verifySignature(signature: string, contentHash: string, publicKey: string): boolean {
  // Simplified signature verification - in production use cryptographic verification
  return signature === createSignature(contentHash, publicKey);
}

function createSignature(contentHash: string, privateKey: string): string {
  // Simplified signature creation
  return `${contentHash}_${privateKey}`;
}