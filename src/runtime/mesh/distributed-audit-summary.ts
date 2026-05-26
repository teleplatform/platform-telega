export interface AuditSummaryFilter {
  eventType?: string;
  action?: string;
  nodeId?: string;
  assignmentId?: string;
  evidenceId?: string;
  workerId?: string;
  severity?: string;
  since?: number;
  until?: number;
  traceId?: string;
}

export interface DistributedAuditSummary {
  timeRange: {
    start: number;
    end: number;
  };
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsByNode: Record<string, number>;
  eventsByAction: Record<string, number>;
  uniqueAssignments: string[];
  uniqueEvidence: string[];
  uniqueWorkers: string[];
  uniqueNodes: string[];
  traceCount: number;
  avgEventsPerTrace: number;
  topActions: Array<{ action: string; count: number }>;
  topNodes: Array<{ nodeId: string; count: number }>;
  generatedAt: number;
}

export interface LayerSummary {
  layer: 'assignment' | 'transport' | 'evidence' | 'worker' | 'system';
  eventCount: number;
  uniqueNodes: string[];
  confidenceAvg: number;
  gaps: number;
}

export interface EvidenceLineageSummary {
  evidenceId: string;
  chainId?: string;
  totalLinks: number;
  layersCovered: string[];
  missingLayers: string[];
  overallConfidence: number;
  hasGaps: boolean;
}

export interface CausalityGap {
  type: 'missing_transport' | 'missing_worker' | 'broken_chain' | 'low_confidence' | 'orphan_evidence' | 'missing_audit';
  evidenceId?: string;
  eventId?: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface DistributedCausalityReport {
  totalChains: number;
  totalEvidenceAnalyzed: number;
  layerSummaries: LayerSummary[];
  evidenceSummaries: EvidenceLineageSummary[];
  gaps: CausalityGap[];
  healthScore: number; // 0-100
  generatedAt: number;
}

export class DistributedAuditSummaryGenerator {
  constructor(private auditEventStore: AuditEventStore) {}

  generateSummary(filter?: AuditSummaryFilter): DistributedAuditSummary {
    const events = this.auditEventStore.searchEvents(filter || {});
    const now = Date.now();

    const timeRange = {
      start: events.length > 0 ? Math.min(...events.map(e => e.timestamp)) : now,
      end: events.length > 0 ? Math.max(...events.map(e => e.timestamp)) : now,
    };

    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    const eventsByNode: Record<string, number> = {};
    const eventsByAction: Record<string, number> = {};
    const uniqueAssignments = new Set<string>();
    const uniqueEvidence = new Set<string>();
    const uniqueWorkers = new Set<string>();
    const uniqueNodes = new Set<string>();

    for (const event of events) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
      eventsByNode[event.nodeId] = (eventsByNode[event.nodeId] || 0) + 1;
      eventsByAction[event.action] = (eventsByAction[event.action] || 0) + 1;

      if (event.assignmentId) uniqueAssignments.add(event.assignmentId);
      if (event.evidenceId) uniqueEvidence.add(event.evidenceId);
      if (event.workerId) uniqueWorkers.add(event.workerId);
      uniqueNodes.add(event.nodeId);
    }

    const traceCount = 0; // would come from trace store

    const topActions = Object.entries(eventsByAction)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([action, count]) => ({ action, count }));

    const topNodes = Object.entries(eventsByNode)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nodeId, count]) => ({ nodeId, count }));

    return {
      timeRange,
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      eventsByNode,
      eventsByAction,
      uniqueAssignments: Array.from(uniqueAssignments),
      uniqueEvidence: Array.from(uniqueEvidence),
      uniqueWorkers: Array.from(uniqueWorkers),
      uniqueNodes: Array.from(uniqueNodes),
      traceCount,
      avgEventsPerTrace: events.length > 0 && traceCount > 0 ? events.length / traceCount : 0,
      topActions,
      topNodes,
      generatedAt: now,
    };
  }

  /**
   * Produces a causality-aware audit report from reconstructed chains.
   * This is the core "explain the lineage" capability for RC-54.
   */
  generateCausalityReport(
    chains: AuditCausalityChain[],
    evidenceIds?: string[]
  ): DistributedCausalityReport {
    const now = Date.now();
    const filteredChains = evidenceIds
      ? chains.filter(c => evidenceIds.some(eid =>
          c.events.includes(eid) ||
          c.links.some(l => l.metadata?.evidenceId === eid)
        ))
      : chains;

    const layerMap: Record<string, { count: number; nodes: Set<string>; confidences: number[] }> = {
      assignment: { count: 0, nodes: new Set(), confidences: [] },
      transport: { count: 0, nodes: new Set(), confidences: [] },
      evidence: { count: 0, nodes: new Set(), confidences: [] },
      worker: { count: 0, nodes: new Set(), confidences: [] },
      system: { count: 0, nodes: new Set(), confidences: [] },
    };

    const evidenceSummaries: EvidenceLineageSummary[] = [];
    const gaps: CausalityGap[] = [];

    for (const chain of filteredChains) {
      const analysis = analyzeCausality(chain);

      // Layer aggregation
      for (const link of chain.links) {
        const layer = link.linkType;
        if (layerMap[layer]) {
          layerMap[layer].count++;
          layerMap[layer].confidences.push(link.confidence);
          // naive node extraction from event ids if present in metadata
          if (link.metadata?.nodeId) layerMap[layer].nodes.add(String(link.metadata.nodeId));
        }
      }

      // Evidence-centric summaries
      const evidenceLinks = chain.links.filter(l => l.linkType === 'evidence' || l.metadata?.evidenceId);
      for (const link of evidenceLinks) {
        const eid = (link.metadata?.evidenceId as string) || link.effectEventId;
        const covered = new Set<string>();
        chain.links.forEach(l => covered.add(l.linkType));

        const missing = ['assignment', 'transport', 'worker'].filter(l => !covered.has(l));

        if (missing.length > 0) {
          gaps.push({
            type: 'missing_transport',
            evidenceId: eid,
            description: `Evidence ${eid} missing layers: ${missing.join(', ')}`,
            severity: 'medium',
          });
        }

        evidenceSummaries.push({
          evidenceId: eid,
          chainId: chain.id,
          totalLinks: chain.links.length,
          layersCovered: Array.from(covered),
          missingLayers: missing,
          overallConfidence: analysis.confidence,
          hasGaps: missing.length > 0 || analysis.confidence < 0.7,
        });
      }

      // Simple broken chain detection
      if (analysis.depth < 2 && chain.links.length > 0) {
        gaps.push({
          type: 'broken_chain',
          description: `Short chain ${chain.id} (depth ${analysis.depth})`,
          severity: 'low',
        });
      }
    }

    const layerSummaries: LayerSummary[] = Object.entries(layerMap).map(([layer, data]) => ({
      layer: layer as any,
      eventCount: data.count,
      uniqueNodes: Array.from(data.nodes),
      confidenceAvg: data.confidences.length > 0
        ? data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length
        : 0,
      gaps: gaps.filter(g => g.description.includes(layer)).length,
    }));

    const healthScore = Math.max(0, Math.min(100,
      100 - (gaps.length * 8) - (evidenceSummaries.filter(e => e.hasGaps).length * 5)
    ));

    return {
      totalChains: filteredChains.length,
      totalEvidenceAnalyzed: evidenceSummaries.length,
      layerSummaries,
      evidenceSummaries,
      gaps,
      healthScore,
      generatedAt: now,
    };
  }
}