export interface EvidenceDeduplicationKey {
  assignmentId: string;
  evidenceType: string;
  originNode: string;
  timestamp: number;
}

export function hashEvidencePayload(payload: any): string {
  return createContentHash(JSON.stringify(payload));
}

export function hashEvidenceEnvelopeId(envelopeId: string): string {
  return createContentHash(envelopeId);
}

export function generateEvidenceHashChain(prevHash: string, envelope: any): string {
  return createContentHash(prevHash + (envelope.assignmentId || '') + (envelope.evidenceType || ''));
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