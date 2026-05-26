import type { AuditCausalityChain } from './audit-causality-chain.js';
import type { LayerSummary, CausalityGap } from './distributed-audit-summary.js';
import type { AuditEvent } from './mesh-audit-events.js';

export interface AuditExportBundle {
  exportVersion: string;
  createdAt: number;
  sourceNodeId: string;
  traceId?: string;
  evidenceIds: string[];
  chains: AuditCausalityChain[];
  layerSummaries: LayerSummary[];
  gaps: CausalityGap[];
  healthScore: number;
  rawEvents?: AuditEvent[];
  metadata?: Record<string, unknown>;
}

export interface CreateAuditExportBundleParams {
  sourceNodeId: string;
  chains: AuditCausalityChain[];
  layerSummaries: LayerSummary[];
  gaps: CausalityGap[];
  healthScore: number;
  evidenceIds?: string[];
  traceId?: string;
  rawEvents?: AuditEvent[];
  metadata?: Record<string, unknown>;
}

export const AUDIT_EXPORT_VERSION = '1.0.0';

export function createAuditExportBundle(params: CreateAuditExportBundleParams): AuditExportBundle {
  const evidenceIds = params.evidenceIds || extractEvidenceIdsFromChains(params.chains);

  return {
    exportVersion: AUDIT_EXPORT_VERSION,
    createdAt: Date.now(),
    sourceNodeId: params.sourceNodeId,
    traceId: params.traceId,
    evidenceIds,
    chains: params.chains,
    layerSummaries: params.layerSummaries,
    gaps: params.gaps,
    healthScore: params.healthScore,
    rawEvents: params.rawEvents,
    metadata: params.metadata || {},
  };
}

export function exportAuditBundleToJSON(bundle: AuditExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function exportAuditBundleToCSV(bundle: AuditExportBundle): string {
  const lines: string[] = [];

  // Header
  lines.push('type,id,layer,confidence,gap_type,severity,description');

  // Evidence IDs
  bundle.evidenceIds.forEach(eid => {
    lines.push(`evidence,${eid},,,`,);
  });

  // Chains summary
  bundle.chains.forEach(chain => {
    lines.push(`chain,${chain.id},,,`);
    chain.links.forEach(link => {
      lines.push(`link,${link.causeEventId}->${link.effectEventId},${link.linkType},${link.confidence},,,`);
    });
  });

  // Gaps
  bundle.gaps.forEach(gap => {
    lines.push(`gap,,${gap.type},,${gap.type},${gap.severity},${gap.description.replace(/,/g, ';')}`);
  });

  // Layer summaries
  bundle.layerSummaries.forEach(layer => {
    lines.push(`layer,,${layer.layer},${layer.confidenceAvg},,,gaps=${layer.gaps}`);
  });

  return lines.join('\n');
}

export function validateAuditBundle(bundle: AuditExportBundle): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!bundle.exportVersion) errors.push('Missing exportVersion');
  if (!bundle.sourceNodeId) errors.push('Missing sourceNodeId');
  if (!Array.isArray(bundle.chains)) errors.push('chains must be an array');
  if (!Array.isArray(bundle.gaps)) errors.push('gaps must be an array');
  if (typeof bundle.healthScore !== 'number' || bundle.healthScore < 0 || bundle.healthScore > 100) {
    errors.push('healthScore must be a number between 0 and 100');
  }

  if (bundle.evidenceIds && !Array.isArray(bundle.evidenceIds)) {
    errors.push('evidenceIds must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function summarizeAuditBundle(bundle: AuditExportBundle): string {
  const validation = validateAuditBundle(bundle);
  const status = validation.valid ? 'VALID' : 'INVALID';

  let summary = `Audit Export Bundle ${status}\n`;
  summary += `Version: ${bundle.exportVersion}\n`;
  summary += `Source: ${bundle.sourceNodeId}\n`;
  summary += `Created: ${new Date(bundle.createdAt).toISOString()}\n`;
  summary += `Evidence IDs: ${bundle.evidenceIds.length}\n`;
  summary += `Chains: ${bundle.chains.length}\n`;
  summary += `Gaps: ${bundle.gaps.length}\n`;
  summary += `Health Score: ${bundle.healthScore}\n`;

  if (bundle.traceId) {
    summary += `Trace: ${bundle.traceId}\n`;
  }

  if (bundle.gaps.length > 0) {
    summary += `\nTop Gaps:\n`;
    bundle.gaps.slice(0, 5).forEach(gap => {
      summary += `  - [${gap.severity}] ${gap.type}: ${gap.description}\n`;
    });
  }

  if (!validation.valid) {
    summary += `\nValidation Errors:\n`;
    validation.errors.forEach(err => summary += `  - ${err}\n`);
  }

  return summary;
}

function extractEvidenceIdsFromChains(chains: AuditCausalityChain[]): string[] {
  const ids = new Set<string>();
  for (const chain of chains) {
    for (const link of chain.links) {
      if (link.metadata?.evidenceId) {
        ids.add(String(link.metadata.evidenceId));
      }
      if (link.linkType === 'evidence') {
        ids.add(link.effectEventId);
      }
    }
  }
  return Array.from(ids);
}
