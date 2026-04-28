// Cost Accounting - Cost Accounting v1
// Integrates with ledger, policy gates, and hooks for cost tracking

import { AgentSessionId, Subject } from '../../types/agentRuntime.js';
import { UsageLedger } from './usageLedger.js';
import { RecoveryCoordinator } from '../recovery/recoveryCoordinator.js';

export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  model: string;
};

export type ToolUsage = {
  toolKind: string;
  toolArgs: any;
};

export type StorageUsage = {
  bytes: number;
  tier: string;
  ttlSeconds: number;
};

export type CostAccountingConfig = {
  defaultTokenCostPerMillionInput: number; // micros per million tokens
  defaultTokenCostPerMillionOutput: number; // micros per million tokens
  defaultToolCallCost: number; // micros per tool call
  defaultStorageCostPerGBHour: number; // micros per GB per hour
};

export class CostAccounting {
  private ledger: UsageLedger;
  private config: CostAccountingConfig;
  
  constructor(config?: Partial<CostAccountingConfig>) {
    this.ledger = new UsageLedger();
    this.config = {
      defaultTokenCostPerMillionInput: config?.defaultTokenCostPerMillionInput ?? 500000, // $0.50/M tokens
      defaultTokenCostPerMillionOutput: config?.defaultTokenCostPerMillionOutput ?? 1500000, // $1.50/M tokens
      defaultToolCallCost: config?.defaultToolCallCost ?? 1000, // $0.001 per call
      defaultStorageCostPerGBHour: config?.defaultStorageCostPerGBHour ?? 100000, // $0.10/GB/hour
    };
  }
  
  /**
   * Record model usage (tokens consumed)
   */
  recordModelUsage(
    subject: Subject,
    sessionId: AgentSessionId,
    jobId: string,
    stepId: string,
    modelUsage: ModelUsage,
    metadata?: Record<string, any>
  ): boolean {
    const idempotencyKey = this.generateUsageIdempotencyKey(subject, sessionId, jobId, stepId, 'model', modelUsage.model);
    
    // Calculate cost based on token counts
    const inputCost = Math.round((modelUsage.inputTokens / 1_000_000) * this.config.defaultTokenCostPerMillionInput);
    const outputCost = Math.round((modelUsage.outputTokens / 1_000_000) * this.config.defaultTokenCostPerMillionOutput);
    const totalCost = inputCost + outputCost;
    
    const entry = {
      subject,
      sessionId,
      jobId,
      stepId,
      kind: 'model' as const,
      units: modelUsage.inputTokens + modelUsage.outputTokens,
      unitType: 'tokens' as const,
      costMicros: totalCost,
      idempotencyKey,
      metadata: {
        ...metadata,
        model: modelUsage.model,
        inputTokens: modelUsage.inputTokens,
        outputTokens: modelUsage.outputTokens,
        inputCost,
        outputCost,
      },
    };
    
    return this.ledger.recordEntry(entry);
  }
  
  /**
   * Record tool usage
   */
  recordToolUsage(
    subject: Subject,
    sessionId: AgentSessionId,
    jobId: string,
    stepId: string,
    toolUsage: ToolUsage,
    costOverride?: number,
    metadata?: Record<string, any>
  ): boolean {
    const idempotencyKey = this.generateUsageIdempotencyKey(subject, sessionId, jobId, stepId, 'tool', toolUsage.toolKind);
    
    // Use override cost if provided, otherwise use default
    const costMicros = costOverride ?? this.config.defaultToolCallCost;
    
    const entry = {
      subject,
      sessionId,
      jobId,
      stepId,
      kind: 'tool' as const,
      units: 1, // One tool call
      unitType: 'calls' as const,
      costMicros,
      idempotencyKey,
      metadata: {
        ...metadata,
        toolKind: toolUsage.toolKind,
        toolArgs: toolUsage.toolArgs,
      },
    };
    
    return this.ledger.recordEntry(entry);
  }
  
  /**
   * Record storage usage
   */
  recordStorageUsage(
    subject: Subject,
    sessionId: AgentSessionId,
    jobId: string,
    stepId: string,
    storageUsage: StorageUsage,
    metadata?: Record<string, any>
  ): boolean {
    const idempotencyKey = this.generateUsageIdempotencyKey(subject, sessionId, jobId, stepId, 'storage', storageUsage.tier);
    
    // Calculate cost: (bytes / 1e9) * (ttlHours) * (costPerGBHour)
    const gb = storageUsage.bytes / 1_000_000_000;
    const hours = storageUsage.ttlSeconds / 3600;
    const costMicros = Math.round(gb * hours * this.config.defaultStorageCostPerGBHour);
    
    const entry = {
      subject,
      sessionId,
      jobId,
      stepId,
      kind: 'storage' as const,
      units: storageUsage.bytes,
      unitType: 'bytes' as const,
      costMicros,
      idempotencyKey,
      metadata: {
        ...metadata,
        bytes: storageUsage.bytes,
        tier: storageUsage.tier,
        ttlSeconds: storageUsage.ttlSeconds,
        gb,
        hours,
      },
    };
    
    return this.ledger.recordEntry(entry);
  }
  
  /**
   * Calculate total cost for a job (monotonic - only increases)
   */
  calculateJobTotal(jobId: string): number {
    return this.ledger.calculateJobTotal(jobId);
  }
  
  /**
   * Calculate total cost for a session (monotonic - only increases)
   */
  calculateSessionTotal(sessionId: AgentSessionId): number {
    return this.ledger.calculateSessionTotal(sessionId);
  }
  
  /**
   * Calculate total cost for a subject
   */
  calculateSubjectTotal(subject: Subject): number {
    return this.ledger.calculateSubjectTotal(subject);
  }
  
  /**
   * Get receipt for a session
   */
  getReceipt(sessionId: AgentSessionId): ReturnType<UsageLedger['getReceipt']> {
    return this.ledger.getReceipt(sessionId);
  }
  
  /**
   * Generate idempotency key for usage entries
   */
  private generateUsageIdempotencyKey(
    subject: Subject,
    sessionId: AgentSessionId,
    jobId: string,
    stepId: string,
    kind: string,
    identifier: string
  ): string {
    const str = `${subject}:${sessionId}:${jobId}:${stepId}:${kind}:${identifier}`;
    return this.simpleHash(str);
  }
  
  /**
   * Simple hash function for idempotency keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36); // Convert to base-36 string
  }
  
  /**
   * Get the underlying ledger (for advanced queries)
   */
  getLedger(): UsageLedger {
    return this.ledger;
  }
  
  /**
   * Check if budget would be exceeded before performing an operation
   */
  async checkBudget(subject: Subject, currentJobId: string, budgetMicros: number): Promise<{ allowed: boolean; current: number; remaining: number }> {
    const current = this.calculateJobTotal(currentJobId);
    const remaining = budgetMicros - current;
    
    return {
      allowed: current < budgetMicros,
      current,
      remaining,
    };
  }
}