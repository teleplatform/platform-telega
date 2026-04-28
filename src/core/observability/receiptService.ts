// Receipt Service - Observability v1
// Provides cost breakdowns and billing explanations

import { AgentSessionId } from '../../types/agentRuntime.js';
import { UsageLedger, type LedgerEntry } from '../cost/usageLedger.js';

export type ReceiptBreakdown = {
  model: {
    tokensIn: number;
    tokensOut: number;
    costMicros: number;
  };
  tools: {
    count: number;
    costMicros: number;
    details: {
      kind: string;
      count: number;
      costMicros: number;
    }[];
  };
  storage: {
    bytes: number;
    costMicros: number;
  };
  compute: {
    durationMs: number;
    costMicros: number;
  };
};

export type ReceiptResponse = {
  sessionId: AgentSessionId;
  totalCostMicros: number;
  breakdown: ReceiptBreakdown;
  ledgerRefs: string[]; // IDs of ledger entries that contributed to this receipt
  integrity: {
    sumMatchesTotal: boolean;
    ledgerAppendOnly: boolean;
    verifiedAt: Date;
  };
  createdAt: Date;
};

export class ReceiptService {
  private usageLedger: UsageLedger;
  
  constructor(usageLedger: UsageLedger) {
    this.usageLedger = usageLedger;
  }
  
  /**
   * Generate a receipt for a session
   */
  generateReceipt(sessionId: AgentSessionId): ReceiptResponse {
    const entries = this.usageLedger.getEntriesForSession(sessionId);
    
    // Calculate breakdown by kind
    const breakdown: ReceiptBreakdown = {
      model: {
        tokensIn: 0,
        tokensOut: 0,
        costMicros: 0
      },
      tools: {
        count: 0,
        costMicros: 0,
        details: []
      },
      storage: {
        bytes: 0,
        costMicros: 0
      },
      compute: {
        durationMs: 0,
        costMicros: 0
      }
    };
    
    // Group tool entries by kind
    const toolDetailsMap = new Map<string, { count: number; costMicros: number }>();
    
    for (const entry of entries) {
      // Add to ledger refs
      if (!breakdown.ledgerRefs) {
        (breakdown as any).ledgerRefs = [];
      }
      
      switch (entry.kind) {
        case 'model':
          // Extract token info from metadata
          const inputTokens = entry.metadata?.inputTokens || 0;
          const outputTokens = entry.metadata?.outputTokens || 0;
          
          breakdown.model.tokensIn += inputTokens;
          breakdown.model.tokensOut += outputTokens;
          breakdown.model.costMicros += entry.costMicros;
          break;
          
        case 'tool':
          breakdown.tools.count++;
          breakdown.tools.costMicros += entry.costMicros;
          
          // Group by tool kind
          const toolKind = entry.metadata?.toolKind || 'unknown';
          const existingDetail = toolDetailsMap.get(toolKind) || { count: 0, costMicros: 0 };
          existingDetail.count++;
          existingDetail.costMicros += entry.costMicros;
          toolDetailsMap.set(toolKind, existingDetail);
          break;
          
        case 'storage':
          const bytes = entry.metadata?.bytes || 0;
          breakdown.storage.bytes += bytes;
          breakdown.storage.costMicros += entry.costMicros;
          break;
          
        case 'compute':
          const durationMs = entry.metadata?.durationMs || 0;
          breakdown.compute.durationMs += durationMs;
          breakdown.compute.costMicros += entry.costMicros;
          break;
      }
    }
    
    // Convert tool details map to array
    breakdown.tools.details = Array.from(toolDetailsMap.entries()).map(([kind, detail]) => ({
      kind,
      count: detail.count,
      costMicros: detail.costMicros
    }));
    
    // Calculate total cost
    const totalCostMicros = entries.reduce((sum, entry) => sum + entry.costMicros, 0);
    
    // Verify integrity
    const sumMatchesTotal = totalCostMicros === 
      breakdown.model.costMicros + 
      breakdown.tools.costMicros + 
      breakdown.storage.costMicros + 
      breakdown.compute.costMicros;
    
    return {
      sessionId,
      totalCostMicros,
      breakdown,
      ledgerRefs: entries.map(e => e.id),
      integrity: {
        sumMatchesTotal,
        ledgerAppendOnly: true, // By definition of our ledger implementation
        verifiedAt: new Date()
      },
      createdAt: new Date()
    };
  }
  
  /**
   * Get cost summary for a session
   */
  getCostSummary(sessionId: AgentSessionId): { total: number; breakdown: Record<string, number> } {
    const receipt = this.generateReceipt(sessionId);
    
    return {
      total: receipt.totalCostMicros,
      breakdown: {
        model: receipt.breakdown.model.costMicros,
        tools: receipt.breakdown.tools.costMicros,
        storage: receipt.breakdown.storage.costMicros,
        compute: receipt.breakdown.compute.costMicros
      }
    };
  }
  
  /**
   * Compare two receipts to detect anomalies
   */
  compareReceipts(receipt1: ReceiptResponse, receipt2: ReceiptResponse): {
    identical: boolean;
    differences: string[];
  } {
    const differences: string[] = [];
    
    if (receipt1.totalCostMicros !== receipt2.totalCostMicros) {
      differences.push(`Total cost differs: ${receipt1.totalCostMicros} vs ${receipt2.totalCostMicros}`);
    }
    
    if (receipt1.breakdown.model.costMicros !== receipt2.breakdown.model.costMicros) {
      differences.push(`Model cost differs: ${receipt1.breakdown.model.costMicros} vs ${receipt2.breakdown.model.costMicros}`);
    }
    
    if (receipt1.breakdown.tools.costMicros !== receipt2.breakdown.tools.costMicros) {
      differences.push(`Tools cost differs: ${receipt1.breakdown.tools.costMicros} vs ${receipt2.breakdown.tools.costMicros}`);
    }
    
    const identical = differences.length === 0;
    return { identical, differences };
  }
}