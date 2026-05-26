export interface EvidenceIntegrityCheck {
  envelopeId: string;
  payloadHash: string;
  signature: string;
  verifiedAt: number;
  verifiedBy: string;
  valid: boolean;
  verificationMethod: string;
  chainOfTrust?: string[];
  error?: string;
}

export interface IntegrityCheckPolicy {
  verificationTimeoutMs: number;
  maxRetries: number;
  trustedSigners: string[];
  minSignatureLength: number;
}

export const DEFAULT_INTEGRITY_CHECK_POLICY: IntegrityCheckPolicy = {
  verificationTimeoutMs: 10000,
  maxRetries: 3,
  trustedSigners: [],
  minSignatureLength: 10,
};

export function checkEvidenceIntegrity(
  envelope: EvidenceEnvelope,
  policy: IntegrityCheckPolicy = DEFAULT_INTEGRITY_CHECK_POLICY
): EvidenceIntegrityCheck {
  if (!envelope.signature || envelope.signature.length < policy.minSignatureLength) {
    return {
      envelopeId: envelope.id,
      payloadHash: hashPayload(envelope.payload),
      signature: envelope.signature,
      verifiedAt: Date.now(),
      verifiedBy: 'system',
      valid: false,
      verificationMethod: 'signature_length_check',
      error: 'Signature too short or missing',
    };
  }

  const payloadHash = hashPayload(envelope.payload);
  const isValid = verifyPayloadSignature(envelope, payloadHash, policy);

  return {
    envelopeId: envelope.id,
    payloadHash,
    signature: envelope.signature,
    verifiedAt: Date.now(),
    verifiedBy: 'mesh-network',
    valid: isValid,
    verificationMethod: 'hmac_verification',
  };
}

export function verifyEvidenceChain(
  envelope: EvidenceEnvelope,
  origin: EvidenceOrigin,
  policy: IntegrityCheckPolicy = DEFAULT_INTEGRITY_CHECK_POLICY
): EvidenceIntegrityCheck {
  if (!origin.signature || origin.signature.length < policy.minSignatureLength) {
    return {
      envelopeId: envelope.id,
      payloadHash: hashPayload(envelope.payload),
      signature: envelope.signature,
      verifiedAt: Date.now(),
      verifiedBy: origin.nodeId,
      valid: false,
      verificationMethod: 'origin_signature_check',
      error: 'Origin signature invalid',
    };
  }

  const integrityCheck = checkEvidenceIntegrity(envelope, policy);
  integrityCheck.verifiedBy = origin.nodeId;
  integrityCheck.chainOfTrust = [origin.nodeId];

  return integrityCheck;
}

function hashPayload(payload: any): string {
  return createContentHash(JSON.stringify(payload));
}

function verifyPayloadSignature(
  envelope: EvidenceEnvelope,
  payloadHash: string,
  policy: IntegrityCheckPolicy
): boolean {
  // Simplified verification - in production this would use proper crypto
  const expectedSignature = createExpectedSignature(payloadHash, envelope.nodeId);
  return envelope.signature === expectedSignature;
}

function createExpectedSignature(payloadHash: string, nodeId: string): string {
  // Placeholder for actual signature generation
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