import {
  EvidenceEnvelope,
  EvidenceOrigin,
  createEvidenceEnvelope,
  createEvidenceOrigin,
} from './mesh-evidence-envelope.js';
import { EvidenceIngestService } from './remote-evidence-ingest.js';
import { InMemoryEvidenceSyncStore } from './evidence-sync-status-store.js';
import { EvidenceOriginNodeService } from './evidence-origin-node.js';
import { EvidenceIntegrityCheck } from './evidence-integrity-check.js';

describe('RC-53: Mesh Evidence Sync', () => {
  let ingestService: EvidenceIngestService;
  let originService: EvidenceOriginNodeService;

  before(() => {
    originService = new EvidenceOriginNodeService();
    ingestService = new EvidenceIngestService();
  });

  describe('Evidence Envelope & Origin', () => {
    it('should create evidence envelope', () => {
      const envelope = createEvidenceEnvelope(
        'assignment-123',
        'task-456',
        'node-1',
        'origin-1',
        'execution',
        { result: 'success' },
        'sig-123',
        Date.now() + 3600000,
        {}
      );
      expect(envelope).toHaveProperty('id');
      expect(envelope.evidenceType).toBe('execution');
    });

    it('should create evidence origin', () => {
      const origin = createEvidenceOrigin(
        'node-1',
        'Primary Node',
        'primary',
        '1.0.0',
        ['execution', 'storage'],
        'sig-456'
      );
      expect(origin).toHaveProperty('nodeId');
      expect(origin.capabilities).toContain('execution');
    });
  });

  describe('Evidence Ingest', () => {
    it('should ingest valid evidence', async () => {
      const origin = createEvidenceOrigin(
        'node-1',
        'Primary Node',
        'primary',
        '1.0.0',
        ['execution'],
        'sig-456'
      );

      const envelope = createEvidenceEnvelope(
        'assignment-123',
        'task-456',
        'node-1',
        'node-1',
        'execution',
        { result: 'success' },
        'sig-123',
        Date.now() + 3600000,
        {}
      );

      const request: any = {
        envelope,
        origin,
        syncToken: 'token-123',
      };

      const response = await ingestService.ingestEvidence(request);
      expect(response.ok).toBe(true);
      expect(response.status).toBe('verified');
      expect(response.envelopeId).toBe(envelope.id);
    });

    it('should reject evidence with missing signature', async () => {
      const envelope = createEvidenceEnvelope(
        'assignment-123',
        'task-456',
        'node-1',
        'node-1',
        'execution',
        { result: 'success' },
        '', // missing signature
        Date.now() + 3600000,
        {}
      );

      const request: any = {
        envelope,
        origin: createEvidenceOrigin('node-1', 'Primary', 'primary', '1.0.0', ['execution'], 'sig'),
        syncToken: 'token-123',
      };

      const response = await ingestService.ingestEvidence(request);
      expect(response.ok).toBe(false);
      expect(response.status).toBe('rejected');
      expect(response.error).toContain('Signature');
    });

    it('should detect duplicate evidence', async () => {
      const origin = createEvidenceOrigin('node-1', 'Primary', 'primary', '1.0.0', ['execution'], 'sig');
      const envelope = createEvidenceEnvelope(
        'assignment-123',
        'task-456',
        'node-1',
        'node-1',
        'execution',
        { result: 'success' },
        'sig-123',
        Date.now() + 3600000,
        {}
      );

      // First ingestion
      const response1 = await ingestService.ingestEvidence({
        envelope,
        origin,
        syncToken: 'token-123',
      });
      expect(response1.ok).toBe(true);

      // Second ingestion should be duplicate
      const response2 = await ingestService.ingestEvidence({
        envelope,
        origin,
        syncToken: 'token-123',
      });
      expect(response2.ok).toBe(true);
      expect(response2.status).toBe('duplicate');
    });
  });

  describe('Evidence Origin Verification', () => {
    it('should verify trusted origin', () => {
      const originService = new EvidenceOriginNodeService();
      const origin = createEvidenceOrigin('node-1', 'Primary', 'primary', '1.0.0', ['execution'], 'sig-123');
      originService.registerOrigin(origin, 100);

      const verification = originService.verifyOrigin(origin);
      expect(verification.verified).toBe(true);
      expect(verification.reason).toBe('Origin is trusted');
    });

    it('should reject untrusted origin', () => {
      const originService = new EvidenceOriginNodeService();
      const origin = createEvidenceOrigin('node-2', 'Unknown', 'worker', '1.0.0', ['storage'], 'sig-456');

      const verification = originService.verifyOrigin(origin);
      expect(verification.verified).toBe(false);
      expect(verification.reason).toContain('not in allowed list');
    });
  });

  describe('Evidence Integrity Check', () => {
    it('should verify evidence integrity', () => {
      const envelope = createEvidenceEnvelope(
        'assignment-123',
        'task-456',
        'node-1',
        'node-1',
        'execution',
        { result: 'success' },
        'sig-123',
        Date.now() + 3600000,
        {}
      );

      const integrityCheck = checkEvidenceIntegrity(envelope, {});
      expect(integrityCheck.valid).toBe(true);
      expect(integrityCheck.payloadHash).toBeDefined();
    });

    it('should reject invalid signature', () => {
      const envelope = createEvidenceEnvelope(
        'assignment-123',
        'task-456',
        'node-1',
        'node-1',
        'execution',
        { result: 'success' },
        'invalid-sig',
        Date.now() + 3600000,
        {}
      );

      const integrityCheck = checkEvidenceIntegrity(envelope, {});
      expect(integrityCheck.valid).toBe(false);
      expect(integrityCheck.verificationMethod).toBe('signature_length_check');
    });
  });
});