import { createHash } from 'crypto';
import { createPrivateKey, createPublicKey, sign } from 'crypto';
import { Subject } from '../../types/agentRuntime.js';
import { ReceiptService } from '../observability/receiptService.js';
import { UsageLedger, type LedgerEntry } from '../cost/usageLedger.js';
import { loadRegistry } from '../security/keyRegistry.js';
import { loadSignaturePolicy } from '../security/signaturePolicy.js';

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export type BillingTransaction = {
  tx_id: string;
  happened_at: string;
  kind: 'model' | 'tool' | 'storage' | 'compute';
  units: number;
  unit_type: string;
  amount_micros: number;
  session_id: string;
  summary: string;
};

export type BillingReceipt = {
  receipt_id: string;
  session_id: string;
  created_at: string;
  total_micros: number;
  breakdown: {
    model_micros: number;
    tool_micros: number;
    storage_micros: number;
    compute_micros: number;
  };
};

export type BillingReceiptDetail = BillingReceipt & {
  usage: {
    model_tokens_in: number;
    model_tokens_out: number;
    tool_calls: number;
    storage_bytes: number;
    compute_ms: number;
  };
  integrity: {
    sum_matches_total: boolean;
    ledger_append_only: boolean;
    verified_at: string;
  };
  summary: string;
};

export type BillingReceiptEventExport = {
  receipt_id: string;
  session_id: string;
  total_micros: number;
  exported_at: string;
  source: {
    kind: 'receipt_breakdown';
    version: 'v1';
  };
  events: Array<{
    seq: number;
    kind: 'model' | 'tool' | 'storage' | 'compute';
    units: number;
    unit_type: 'tokens' | 'calls' | 'bytes' | 'milliseconds';
    amount_micros: number;
  }>;
  digest_sha256: string;
};

export type BillingDispute = {
  dispute_id: string;
  receipt_id: string;
  status: BillingDisputeStatus;
  status_view: {
    badge_label: string;
    description: string;
  };
  reason: string;
  created_at: string;
  updated_at: string;
  timeline: Array<{
    at: string;
    status: BillingDisputeStatus;
    message: string;
  }>;
  next_step: {
    hint: string;
    eta_hours: number;
  };
  resolution: {
    summary: string;
    resolved_at: string;
  } | null;
};

export type BillingDisputeStatus = 'open' | 'reviewing' | 'resolved' | 'closed';
export type BillingActorRole = 'maker' | 'public';

export type BillingDisputeStatusPresentation = {
  badge_label: string;
  description: string;
  next_step: {
    hint: string;
    eta_hours: number;
  };
};

export type BillingDisputeTimelineEntry = {
  at: string;
  status: BillingDisputeStatus;
  message: string;
};

export type BillingDisputeEventExport = {
  dispute_id: string;
  receipt_id: string;
  status: BillingDisputeStatus;
  exported_at: string;
  source: {
    kind: 'dispute_timeline';
    version: 'v1';
  };
  events: Array<{
    seq: number;
    at: string;
    status: BillingDisputeStatus;
    badge_label: string;
    message: string;
  }>;
  digest_sha256: string;
};

export type UnifiedExportManifest = {
  exported_at: string;
  source: {
    kind: 'unified_export_manifest';
    version: 'v1';
  };
  receipts: Array<{
    receipt_id: string;
    session_id: string;
    total_micros: number;
    digest_sha256: string;
  }>;
  disputes: Array<{
    dispute_id: string;
    receipt_id: string;
    status: BillingDisputeStatus;
    digest_sha256: string;
  }>;
  manifest_digest_sha256: string;
};

export type UnifiedExportBundle = {
  exported_at: string;
  source: {
    kind: 'unified_export_bundle';
    version: 'v1';
  };
  selections: {
    receipt_ids: string[];
    dispute_ids: string[];
  };
  files: Array<{
    path: string;
    digest_sha256: string;
    size_bytes: number;
    content: string;
  }>;
  bundle_digest_sha256: string;
};

export type UnifiedExportZipBundle = {
  exported_at: string;
  source: {
    kind: 'unified_export_zip_bundle';
    version: 'v1';
  };
  files: Array<{
    path: string;
    digest_sha256: string;
    size_bytes: number;
  }>;
  bundle_digest_sha256: string;
  zip: Buffer;
};

export type UnifiedExportSignedZipBundle = {
  exported_at: string;
  source: {
    kind: 'unified_export_signed_zip_bundle';
    version: 'v1';
  };
  bundle_digest_sha256: string;
  signature: {
    alg: 'ed25519';
    key_id: string;
    signature_b64: string;
  };
  signature_v2: {
    kind: 'telecore_bundle_signature';
    version: 'v1';
    alg: 'ed25519';
    key_id: string;
    message_v: 'v2';
    message_sha256: string;
    signature_b64: string;
  };
  signature_v3: {
    kind: 'telecore_bundle_signature';
    version: 'v2';
    alg: 'ed25519';
    key_id: string;
    message_v: 'v3';
    message_sha256: string;
    signature_b64: string;
  };
  public_key: {
    kind: 'telecore_signature_pubkey';
    version: 'v1';
    alg: 'ed25519';
    key_id: string;
    public_key_b64: string;
    created_at: string;
  };
  trust_registry: {
    kind: 'telecore_trust_registry_digest';
    version: 'v1';
    registry_version: 'v1';
    registry_updated_at: string;
    registry_digest_sha256: string;
  };
  trust_policy: {
    kind: 'telecore_signature_policy_digest';
    version: 'v1';
    policy_version: 'v1';
    policy_updated_at: string;
    policy_digest_sha256: string;
    required_message_v: 'v3';
  };
  files: Array<{
    path: string;
    digest_sha256: string;
    size_bytes: number;
  }>;
  zip: Buffer;
};

type InternalBillingDispute = {
  dispute_id: string;
  receipt_id: string;
  status: BillingDisputeStatus;
  reason: string;
  created_at: string;
  updated_at: string;
  timeline: BillingDisputeTimelineEntry[];
  subject_id: Subject;
};

export class UserBillingService {
  private readonly usageLedger: UsageLedger;
  private readonly receiptService: ReceiptService;
  private readonly disputes = new Map<string, InternalBillingDispute[]>();
  private readonly baseBalanceMicros: number;

  constructor(usageLedger: UsageLedger, baseBalanceMicros: number = 2_000_000) {
    this.usageLedger = usageLedger;
    this.receiptService = new ReceiptService(usageLedger);
    this.baseBalanceMicros = baseBalanceMicros;
  }

  getDisputeStatusPresentation(status: BillingDisputeStatus): BillingDisputeStatusPresentation {
    const map: Record<BillingDisputeStatus, BillingDisputeStatusPresentation> = {
      open: {
        badge_label: 'Open',
        description: 'Обращение зарегистрировано и ожидает первичной проверки.',
        next_step: {
          hint: 'Мы рассмотрим обращение и обновим статус.',
          eta_hours: 24,
        },
      },
      reviewing: {
        badge_label: 'Reviewing',
        description: 'Обращение находится на ручной проверке.',
        next_step: {
          hint: 'Ожидайте результат проверки и возможные уточнения.',
          eta_hours: 12,
        },
      },
      resolved: {
        badge_label: 'Resolved',
        description: 'Проверка завершена, решение зафиксировано.',
        next_step: {
          hint: 'Дополнительных действий не требуется.',
          eta_hours: 0,
        },
      },
      closed: {
        badge_label: 'Closed',
        description: 'Спор закрыт и архивирован.',
        next_step: {
          hint: 'Тикет закрыт. Можно открыть новый спор при необходимости.',
          eta_hours: 0,
        },
      },
    };
    return map[status];
  }

  getBillingSnapshot(subjectId: Subject) {
    const entries = this.getSubjectEntries(subjectId);
    const spent = entries.reduce((sum, entry) => sum + entry.costMicros, 0);
    const balance = Math.max(0, this.baseBalanceMicros - spent);

    return {
      balance_teleton_micros: balance,
      transactions: this.toTransactions(entries).slice(0, 20),
      receipts: this.getReceipts(subjectId).slice(0, 10),
      dispute: {
        create_path: '/api/v1/user/disputes',
      },
    };
  }

  getReceipts(subjectId: Subject): BillingReceipt[] {
    const entries = this.getSubjectEntries(subjectId);
    const sessions = new Map<string, LedgerEntry[]>();
    for (const entry of entries) {
      if (!sessions.has(entry.sessionId)) {
        sessions.set(entry.sessionId, []);
      }
      sessions.get(entry.sessionId)!.push(entry);
    }

    return Array.from(sessions.entries())
      .map(([sessionId, sessionEntries]) => {
        const receipt = this.receiptService.generateReceipt(sessionId);
        const createdAt = sessionEntries
          .map((entry) => entry.timestamp.getTime())
          .sort((a, b) => b - a)[0];

        return {
          receipt_id: this.getReceiptId(sessionId),
          session_id: sessionId,
          created_at: new Date(createdAt).toISOString(),
          total_micros: receipt.totalCostMicros,
          breakdown: {
            model_micros: receipt.breakdown.model.costMicros,
            tool_micros: receipt.breakdown.tools.costMicros,
            storage_micros: receipt.breakdown.storage.costMicros,
            compute_micros: receipt.breakdown.compute.costMicros,
          },
        };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  getReceiptDetail(subjectId: Subject, receiptId: string): BillingReceiptDetail | null {
    const receipt = this.getReceipts(subjectId).find((item) => item.receipt_id === receiptId);
    if (!receipt) {
      return null;
    }

    const raw = this.receiptService.generateReceipt(receipt.session_id);
    return {
      ...receipt,
      usage: {
        model_tokens_in: raw.breakdown.model.tokensIn,
        model_tokens_out: raw.breakdown.model.tokensOut,
        tool_calls: raw.breakdown.tools.count,
        storage_bytes: raw.breakdown.storage.bytes,
        compute_ms: raw.breakdown.compute.durationMs,
      },
      integrity: {
        sum_matches_total: raw.integrity.sumMatchesTotal,
        ledger_append_only: raw.integrity.ledgerAppendOnly,
        verified_at: raw.integrity.verifiedAt.toISOString(),
      },
      summary: `Receipt for session ${receipt.session_id}`,
    };
  }

  getReceiptEventExport(
    subjectId: Subject,
    receiptId: string,
    exportedAt: string = new Date().toISOString()
  ): BillingReceiptEventExport | null {
    const detail = this.getReceiptDetail(subjectId, receiptId);
    if (!detail) {
      return null;
    }

    const events: BillingReceiptEventExport['events'] = [
      {
        seq: 1,
        kind: 'model',
        units: detail.usage.model_tokens_in + detail.usage.model_tokens_out,
        unit_type: 'tokens',
        amount_micros: detail.breakdown.model_micros,
      },
      {
        seq: 2,
        kind: 'tool',
        units: detail.usage.tool_calls,
        unit_type: 'calls',
        amount_micros: detail.breakdown.tool_micros,
      },
      {
        seq: 3,
        kind: 'storage',
        units: detail.usage.storage_bytes,
        unit_type: 'bytes',
        amount_micros: detail.breakdown.storage_micros,
      },
      {
        seq: 4,
        kind: 'compute',
        units: detail.usage.compute_ms,
        unit_type: 'milliseconds',
        amount_micros: detail.breakdown.compute_micros,
      },
    ];

    const canonical = JSON.stringify({
      receipt_id: detail.receipt_id,
      session_id: detail.session_id,
      total_micros: detail.total_micros,
      events,
    });

    return {
      receipt_id: detail.receipt_id,
      session_id: detail.session_id,
      total_micros: detail.total_micros,
      exported_at: exportedAt,
      source: {
        kind: 'receipt_breakdown',
        version: 'v1',
      },
      events,
      digest_sha256: createHash('sha256').update(canonical).digest('hex'),
    };
  }

  createDispute(subjectId: Subject, receiptId: string, reason: string): BillingDispute {
    const now = new Date().toISOString();
    const dispute: InternalBillingDispute = {
      dispute_id: `dsp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      subject_id: subjectId,
      receipt_id: receiptId,
      reason,
      status: 'open',
      created_at: now,
      updated_at: now,
      timeline: [
        {
          at: now,
          status: 'open',
          message: 'Принято в работу',
        },
      ],
    };
    const existing = this.disputes.get(subjectId) ?? [];
    existing.push(dispute);
    this.disputes.set(subjectId, existing);
    return this.toUserSafeDispute(dispute);
  }

  listDisputes(subjectId: Subject): BillingDispute[] {
    return [...(this.disputes.get(subjectId) ?? [])]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((dispute) => this.toUserSafeDispute(dispute));
  }

  getDisputeDetail(subjectId: Subject, disputeId: string): BillingDispute | null {
    const dispute = (this.disputes.get(subjectId) ?? []).find((item) => item.dispute_id === disputeId);
    if (!dispute) {
      return null;
    }
    return this.toUserSafeDispute(dispute);
  }

  getDisputeEventExport(
    subjectId: Subject,
    disputeId: string,
    exportedAt: string = new Date().toISOString()
  ): BillingDisputeEventExport | null {
    const detail = this.getDisputeDetail(subjectId, disputeId);
    if (!detail) {
      return null;
    }

    const events = detail.timeline.map((entry, index) => ({
      seq: index + 1,
      at: entry.at,
      status: entry.status,
      badge_label: this.getDisputeStatusPresentation(entry.status).badge_label,
      message: entry.message,
    }));

    const canonical = JSON.stringify({
      dispute_id: detail.dispute_id,
      receipt_id: detail.receipt_id,
      status: detail.status,
      events,
    });

    return {
      dispute_id: detail.dispute_id,
      receipt_id: detail.receipt_id,
      status: detail.status,
      exported_at: exportedAt,
      source: {
        kind: 'dispute_timeline',
        version: 'v1',
      },
      events,
      digest_sha256: createHash('sha256').update(canonical).digest('hex'),
    };
  }

  getUnifiedExportManifest(
    subjectId: Subject,
    exportedAt: string = new Date().toISOString()
  ): UnifiedExportManifest {
    const receipts = this.getReceipts(subjectId)
      .map((receipt) => {
        const exportPayload = this.getReceiptEventExport(subjectId, receipt.receipt_id, exportedAt);
        if (!exportPayload) {
          return null;
        }
        return {
          receipt_id: receipt.receipt_id,
          session_id: receipt.session_id,
          total_micros: receipt.total_micros,
          digest_sha256: exportPayload.digest_sha256,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.receipt_id.localeCompare(b.receipt_id));

    const disputes = this.listDisputes(subjectId)
      .map((dispute) => {
        const exportPayload = this.getDisputeEventExport(subjectId, dispute.dispute_id, exportedAt);
        if (!exportPayload) {
          return null;
        }
        return {
          dispute_id: dispute.dispute_id,
          receipt_id: dispute.receipt_id,
          status: dispute.status,
          digest_sha256: exportPayload.digest_sha256,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.dispute_id.localeCompare(b.dispute_id));

    const canonical = JSON.stringify({
      receipts,
      disputes,
    });

    return {
      exported_at: exportedAt,
      source: {
        kind: 'unified_export_manifest',
        version: 'v1',
      },
      receipts,
      disputes,
      manifest_digest_sha256: createHash('sha256').update(canonical).digest('hex'),
    };
  }

  getUnifiedExportBundle(
    subjectId: Subject,
    options?: {
      receiptIds?: string[];
      disputeIds?: string[];
      exportedAt?: string;
    }
  ): UnifiedExportBundle {
    const exportedAt = options?.exportedAt ?? new Date().toISOString();
    const allReceipts = this.getReceipts(subjectId).map((item) => item.receipt_id).sort((a, b) => a.localeCompare(b));
    const allDisputes = this.listDisputes(subjectId).map((item) => item.dispute_id).sort((a, b) => a.localeCompare(b));

    const selectedReceipts = (options?.receiptIds?.length ? options.receiptIds : allReceipts)
      .filter((id, index, arr) => arr.indexOf(id) === index)
      .filter((id) => allReceipts.includes(id))
      .sort((a, b) => a.localeCompare(b));
    const selectedDisputes = (options?.disputeIds?.length ? options.disputeIds : allDisputes)
      .filter((id, index, arr) => arr.indexOf(id) === index)
      .filter((id) => allDisputes.includes(id))
      .sort((a, b) => a.localeCompare(b));

    const manifest = this.getUnifiedExportManifest(subjectId, exportedAt);
    const files: UnifiedExportBundle['files'] = [];

    const pushFile = (path: string, content: string) => {
      files.push({
        path,
        digest_sha256: createHash('sha256').update(content).digest('hex'),
        size_bytes: Buffer.byteLength(content, 'utf8'),
        content,
      });
    };

    pushFile('manifest.json', JSON.stringify(manifest));

    for (const receiptId of selectedReceipts) {
      const payload = this.getReceiptEventExport(subjectId, receiptId, exportedAt);
      if (!payload) {
        continue;
      }
      pushFile(`receipts/${receiptId}.json`, JSON.stringify(payload));
    }

    for (const disputeId of selectedDisputes) {
      const payload = this.getDisputeEventExport(subjectId, disputeId, exportedAt);
      if (!payload) {
        continue;
      }
      pushFile(`disputes/${disputeId}.json`, JSON.stringify(payload));
    }

    files.sort((a, b) => a.path.localeCompare(b.path));

    const bundleCanonical = JSON.stringify(
      files.map((file) => ({
        path: file.path,
        digest_sha256: file.digest_sha256,
        size_bytes: file.size_bytes,
      }))
    );

    return {
      exported_at: exportedAt,
      source: {
        kind: 'unified_export_bundle',
        version: 'v1',
      },
      selections: {
        receipt_ids: selectedReceipts,
        dispute_ids: selectedDisputes,
      },
      files,
      bundle_digest_sha256: createHash('sha256').update(bundleCanonical).digest('hex'),
    };
  }

  getUnifiedExportZipBundle(
    subjectId: Subject,
    options?: {
      receiptIds?: string[];
      disputeIds?: string[];
      exportedAt?: string;
    }
  ): UnifiedExportZipBundle {
    const exportedAt = options?.exportedAt ?? new Date().toISOString();
    const bundle = this.getUnifiedExportBundle(subjectId, {
      receiptIds: options?.receiptIds,
      disputeIds: options?.disputeIds,
      exportedAt,
    });

    const files = [
      ...bundle.files.map((file) => ({
        path: file.path,
        digest_sha256: file.digest_sha256,
        size_bytes: file.size_bytes,
        content: file.content,
      })),
      {
        path: 'bundle.sha256',
        digest_sha256: createHash('sha256').update(`${bundle.bundle_digest_sha256}\n`).digest('hex'),
        size_bytes: Buffer.byteLength(`${bundle.bundle_digest_sha256}\n`, 'utf8'),
        content: `${bundle.bundle_digest_sha256}\n`,
      },
    ].sort((a, b) => a.path.localeCompare(b.path));

    const zip = this.buildDeterministicZipFromFiles(
      files.map((file) => ({ path: file.path, content: file.content })),
      exportedAt
    );

    return {
      exported_at: exportedAt,
      source: {
        kind: 'unified_export_zip_bundle',
        version: 'v1',
      },
      files: files.map((file) => ({
        path: file.path,
        digest_sha256: file.digest_sha256,
        size_bytes: file.size_bytes,
      })),
      bundle_digest_sha256: bundle.bundle_digest_sha256,
      zip,
    };
  }

  getUnifiedExportSignedZipBundle(
    subjectId: Subject,
    options?: {
      receiptIds?: string[];
      disputeIds?: string[];
      exportedAt?: string;
    }
  ): UnifiedExportSignedZipBundle {
    const exportedAt = options?.exportedAt ?? new Date().toISOString();
    const bundle = this.getUnifiedExportBundle(subjectId, {
      receiptIds: options?.receiptIds,
      disputeIds: options?.disputeIds,
      exportedAt,
    });

    const signing = this.getSigningMaterial();
    const signaturePolicy = loadSignaturePolicy(process.env.TELECORE_SIGNATURE_POLICY_PATH);
    const legacyMessage = Buffer.from(`${bundle.bundle_digest_sha256}\n`, 'utf8');
    const legacySignatureB64 = sign(null, legacyMessage, signing.privateKey).toString('base64');
    const messageV2 = Buffer.from(
      `${bundle.bundle_digest_sha256}\n${signing.registryDigestSha256}\n${signing.keyId}\n`,
      'utf8'
    );
    const messageV2Sha256 = createHash('sha256').update(messageV2).digest('hex');
    const signatureV2B64 = sign(null, messageV2, signing.privateKey).toString('base64');
    const messageV3 = Buffer.from(
      `${bundle.bundle_digest_sha256}\n${signing.registryDigestSha256}\n${signing.keyId}\n${exportedAt}\n`,
      'utf8'
    );
    const messageV3Sha256 = createHash('sha256').update(messageV3).digest('hex');
    const signatureV3B64 = sign(null, messageV3, signing.privateKey).toString('base64');

    const pub = {
      kind: 'telecore_signature_pubkey' as const,
      version: 'v1' as const,
      alg: 'ed25519' as const,
      key_id: signing.keyId,
      public_key_b64: signing.publicKeySpkiB64,
      created_at: signing.createdAt,
    };
    const trustRegistry = {
      kind: 'telecore_trust_registry_digest' as const,
      version: 'v1' as const,
      registry_version: signing.registryVersion,
      registry_updated_at: signing.registryUpdatedAt,
      registry_digest_sha256: signing.registryDigestSha256,
    };
    const trustPolicy = {
      kind: 'telecore_signature_policy_digest' as const,
      version: 'v1' as const,
      policy_version: signaturePolicy.policy.version,
      policy_updated_at: signaturePolicy.policy.updated_at,
      policy_digest_sha256: signaturePolicy.digest_sha256,
      required_message_v: signaturePolicy.policy.required_message_v,
    };
    const signatureV2 = {
      kind: 'telecore_bundle_signature' as const,
      version: 'v1' as const,
      alg: 'ed25519' as const,
      key_id: signing.keyId,
      message_v: 'v2' as const,
      message_sha256: messageV2Sha256,
      signature_b64: signatureV2B64,
    };
    const signatureV3 = {
      kind: 'telecore_bundle_signature' as const,
      version: 'v2' as const,
      alg: 'ed25519' as const,
      key_id: signing.keyId,
      message_v: 'v3' as const,
      message_sha256: messageV3Sha256,
      signature_b64: signatureV3B64,
    };

    const files = [
      ...bundle.files.map((file) => ({
        path: file.path,
        digest_sha256: file.digest_sha256,
        size_bytes: file.size_bytes,
        content: file.content,
      })),
      {
        path: 'bundle.sha256',
        digest_sha256: createHash('sha256').update(`${bundle.bundle_digest_sha256}\n`).digest('hex'),
        size_bytes: Buffer.byteLength(`${bundle.bundle_digest_sha256}\n`, 'utf8'),
        content: `${bundle.bundle_digest_sha256}\n`,
      },
      {
        path: 'bundle.pub.json',
        digest_sha256: createHash('sha256').update(JSON.stringify(pub)).digest('hex'),
        size_bytes: Buffer.byteLength(JSON.stringify(pub), 'utf8'),
        content: JSON.stringify(pub),
      },
      {
        path: 'bundle.sig',
        digest_sha256: createHash('sha256').update(`${legacySignatureB64}\n`).digest('hex'),
        size_bytes: Buffer.byteLength(`${legacySignatureB64}\n`, 'utf8'),
        content: `${legacySignatureB64}\n`,
      },
      {
        path: 'bundle.sig.json',
        digest_sha256: createHash('sha256').update(JSON.stringify(signatureV2)).digest('hex'),
        size_bytes: Buffer.byteLength(JSON.stringify(signatureV2), 'utf8'),
        content: JSON.stringify(signatureV2),
      },
      {
        path: 'bundle.sig.v3.json',
        digest_sha256: createHash('sha256').update(JSON.stringify(signatureV3)).digest('hex'),
        size_bytes: Buffer.byteLength(JSON.stringify(signatureV3), 'utf8'),
        content: JSON.stringify(signatureV3),
      },
      {
        path: 'bundle.registry.json',
        digest_sha256: createHash('sha256').update(JSON.stringify(trustRegistry)).digest('hex'),
        size_bytes: Buffer.byteLength(JSON.stringify(trustRegistry), 'utf8'),
        content: JSON.stringify(trustRegistry),
      },
      {
        path: 'bundle.policy.json',
        digest_sha256: createHash('sha256').update(JSON.stringify(trustPolicy)).digest('hex'),
        size_bytes: Buffer.byteLength(JSON.stringify(trustPolicy), 'utf8'),
        content: JSON.stringify(trustPolicy),
      },
    ].sort((a, b) => a.path.localeCompare(b.path));

    const zip = this.buildDeterministicZipFromFiles(
      files.map((file) => ({ path: file.path, content: file.content })),
      exportedAt
    );

    return {
      exported_at: exportedAt,
      source: {
        kind: 'unified_export_signed_zip_bundle',
        version: 'v1',
      },
      bundle_digest_sha256: bundle.bundle_digest_sha256,
      signature: {
        alg: 'ed25519',
        key_id: signing.keyId,
        signature_b64: legacySignatureB64,
      },
      signature_v2: signatureV2,
      signature_v3: signatureV3,
      public_key: pub,
      trust_registry: trustRegistry,
      trust_policy: trustPolicy,
      files: files.map((file) => ({
        path: file.path,
        digest_sha256: file.digest_sha256,
        size_bytes: file.size_bytes,
      })),
      zip,
    };
  }

  simulateDisputeStatus(
    subjectId: Subject,
    disputeId: string,
    nextStatus: BillingDisputeStatus,
    actorRole: BillingActorRole,
    message?: string
  ): BillingDispute {
    if (actorRole !== 'maker') {
      throw new Error('FORBIDDEN: maker role required');
    }

    const disputes = this.disputes.get(subjectId) ?? [];
    const index = disputes.findIndex((item) => item.dispute_id === disputeId);
    if (index < 0) {
      throw new Error('NOT_FOUND: dispute not found');
    }

    const current = disputes[index];
    if (!this.isTransitionAllowed(current.status, nextStatus)) {
      throw new Error(`BAD_REQUEST: invalid transition ${current.status} -> ${nextStatus}`);
    }

    const beforeTimeline = current.timeline.map((entry) => ({ ...entry }));
    const now = new Date().toISOString();
    const lastAt = current.timeline[current.timeline.length - 1]?.at ?? current.created_at;
    const nextAt = now > lastAt ? now : new Date(new Date(lastAt).getTime() + 1000).toISOString();

    const nextTimeline: BillingDisputeTimelineEntry[] = [
      ...current.timeline,
      {
        at: nextAt,
        status: nextStatus,
        message: message?.trim() || this.getDefaultTimelineMessage(nextStatus),
      },
    ];

    // Strict timeline append rules: append-only, monotonic timestamps.
    for (let i = 0; i < beforeTimeline.length; i += 1) {
      const prev = beforeTimeline[i];
      const candidate = nextTimeline[i];
      if (prev.at !== candidate.at || prev.status !== candidate.status || prev.message !== candidate.message) {
        throw new Error('INTERNAL_ERROR: timeline mutation detected');
      }
    }
    for (let i = 1; i < nextTimeline.length; i += 1) {
      if (nextTimeline[i].at < nextTimeline[i - 1].at) {
        throw new Error('INTERNAL_ERROR: timeline is not monotonic');
      }
    }

    const updated: InternalBillingDispute = {
      ...current,
      status: nextStatus,
      updated_at: nextAt,
      timeline: nextTimeline,
    };
    disputes[index] = updated;
    this.disputes.set(subjectId, disputes);
    return this.toUserSafeDispute(updated);
  }

  private getSubjectEntries(subjectId: Subject): LedgerEntry[] {
    return this.usageLedger
      .getEntries({ subject: subjectId })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private toTransactions(entries: LedgerEntry[]): BillingTransaction[] {
    return entries.map((entry, index) => ({
      tx_id: `tx_${entry.timestamp.getTime()}_${index + 1}`,
      happened_at: entry.timestamp.toISOString(),
      kind: entry.kind,
      units: entry.units,
      unit_type: entry.unitType,
      amount_micros: entry.costMicros,
      session_id: entry.sessionId,
      summary: this.getSummary(entry),
    }));
  }

  private getSummary(entry: LedgerEntry): string {
    if (entry.kind === 'model') {
      return 'Model usage';
    }
    if (entry.kind === 'tool') {
      return `Tool call: ${entry.metadata?.toolKind ?? 'unknown'}`;
    }
    if (entry.kind === 'storage') {
      return 'Storage usage';
    }
    return 'Compute usage';
  }

  private getReceiptId(sessionId: string): string {
    return `rcpt_${sessionId}`;
  }

  private isTransitionAllowed(from: BillingDisputeStatus, to: BillingDisputeStatus): boolean {
    if (from === to) {
      return true;
    }
    const allowed: Record<BillingDisputeStatus, BillingDisputeStatus[]> = {
      open: ['reviewing', 'closed'],
      reviewing: ['resolved', 'closed'],
      resolved: ['closed'],
      closed: [],
    };
    return allowed[from].includes(to);
  }

  private getDefaultTimelineMessage(status: BillingDisputeStatus): string {
    if (status === 'reviewing') {
      return 'Передано на проверку';
    }
    if (status === 'resolved') {
      return 'Решение принято';
    }
    if (status === 'closed') {
      return 'Спор закрыт';
    }
    return 'Статус обновлён';
  }

  private toUserSafeDispute(dispute: InternalBillingDispute): BillingDispute {
    const presentation = this.getDisputeStatusPresentation(dispute.status);
    return {
      dispute_id: dispute.dispute_id,
      receipt_id: dispute.receipt_id,
      status: dispute.status,
      status_view: {
        badge_label: presentation.badge_label,
        description: presentation.description,
      },
      reason: dispute.reason,
      created_at: dispute.created_at,
      updated_at: dispute.updated_at,
      timeline: [...dispute.timeline].sort((a, b) => a.at.localeCompare(b.at)),
      next_step: presentation.next_step,
      resolution: dispute.status === 'resolved' || dispute.status === 'closed'
        ? {
            summary: 'Решение по спору зафиксировано.',
            resolved_at: dispute.updated_at,
          }
        : null,
    };
  }

  private buildDeterministicZipFromFiles(
    files: Array<{ path: string; content: string }>,
    exportedAt: string
  ): Buffer {
    const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
    const date = new Date(exportedAt);
    const safeDate = Number.isFinite(date.getTime()) ? date : new Date('1980-01-01T00:00:00.000Z');
    const { dosDate, dosTime } = this.toDosDateTime(safeDate);

    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;

    for (const file of sorted) {
      const name = Buffer.from(file.path, 'utf8');
      const data = Buffer.from(file.content, 'utf8');
      const crc = this.crc32(data);
      const size = data.length;

      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0, 6);
      localHeader.writeUInt16LE(0, 8); // STORE
      localHeader.writeUInt16LE(dosTime, 10);
      localHeader.writeUInt16LE(dosDate, 12);
      localHeader.writeUInt32LE(crc, 14);
      localHeader.writeUInt32LE(size, 18);
      localHeader.writeUInt32LE(size, 22);
      localHeader.writeUInt16LE(name.length, 26);
      localHeader.writeUInt16LE(0, 28);

      localParts.push(localHeader, name, data);

      const centralHeader = Buffer.alloc(46);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0, 8);
      centralHeader.writeUInt16LE(0, 10); // STORE
      centralHeader.writeUInt16LE(dosTime, 12);
      centralHeader.writeUInt16LE(dosDate, 14);
      centralHeader.writeUInt32LE(crc, 16);
      centralHeader.writeUInt32LE(size, 20);
      centralHeader.writeUInt32LE(size, 24);
      centralHeader.writeUInt16LE(name.length, 28);
      centralHeader.writeUInt16LE(0, 30);
      centralHeader.writeUInt16LE(0, 32);
      centralHeader.writeUInt16LE(0, 34);
      centralHeader.writeUInt16LE(0, 36);
      centralHeader.writeUInt32LE(0, 38);
      centralHeader.writeUInt32LE(offset, 42);
      centralParts.push(centralHeader, name);

      offset += localHeader.length + name.length + data.length;
    }

    const centralDir = Buffer.concat(centralParts);
    const localDir = Buffer.concat(localParts);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(sorted.length, 8);
    eocd.writeUInt16LE(sorted.length, 10);
    eocd.writeUInt32LE(centralDir.length, 12);
    eocd.writeUInt32LE(localDir.length, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([localDir, centralDir, eocd]);
  }

  private toDosDateTime(date: Date): { dosDate: number; dosTime: number } {
    const year = Math.min(2107, Math.max(1980, date.getUTCFullYear()));
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    const second = Math.floor(date.getUTCSeconds() / 2);

    const dosDate = ((year - 1980) << 9) | (month << 5) | day;
    const dosTime = (hour << 11) | (minute << 5) | second;
    return { dosDate, dosTime };
  }

  private crc32(buffer: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of buffer) {
      crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  private getSigningMaterial(): {
    privateKey: ReturnType<typeof createPrivateKey>;
    publicKeySpkiB64: string;
    keyId: string;
    createdAt: string;
    registryVersion: 'v1';
    registryUpdatedAt: string;
    registryDigestSha256: string;
  } {
    const keyId = process.env.TELECORE_SIGNING_KEY_ID || 'telecore_dev_2026q1';
    const { registry, digest_sha256 } = loadRegistry(process.env.TELECORE_KEY_REGISTRY_PATH);
    const registryKey = registry.keys.find((key) => key.key_id === keyId);
    if (!registryKey) {
      throw new Error(`K2.13 signing key_id not found in registry: ${keyId}`);
    }
    if (registryKey.alg !== 'ed25519') {
      throw new Error(`K2.13 unsupported signing alg for key_id ${keyId}: ${registryKey.alg}`);
    }
    if (registryKey.status !== 'active') {
      throw new Error(`K2.13 signing key must be active in registry: ${keyId} [${registryKey.status}]`);
    }

    const createdAt = process.env.TELECORE_SIGNING_PUB_CREATED_AT || registryKey.created_at;
    const b64 = process.env.TELECORE_SIGNING_KEY_ED25519_B64 || 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    const raw = Buffer.from(b64, 'base64');

    let privateKey: ReturnType<typeof createPrivateKey>;
    if (raw.length === 32) {
      const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
      privateKey = createPrivateKey({
        key: Buffer.concat([prefix, raw]),
        format: 'der',
        type: 'pkcs8',
      });
    } else {
      privateKey = createPrivateKey({
        key: raw,
        format: 'der',
        type: 'pkcs8',
      });
    }

    const publicKeySpkiB64 = createPublicKey(privateKey).export({
      format: 'der',
      type: 'spki',
    }).toString('base64');
    if (publicKeySpkiB64 !== registryKey.public_key_spki_b64) {
      throw new Error(`K2.13 signing key mismatch for key_id ${keyId}: env private key does not match registry public key`);
    }

    return {
      privateKey,
      publicKeySpkiB64: registryKey.public_key_spki_b64,
      keyId: registryKey.key_id,
      createdAt,
      registryVersion: registry.registry_version,
      registryUpdatedAt: registry.updated_at,
      registryDigestSha256: digest_sha256,
    };
  }
}
