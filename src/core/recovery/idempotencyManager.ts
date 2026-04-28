// Idempotency Manager - Recovery & Resume v1
// Prevents duplicate tool executions and side effects

import { AgentSessionId } from '../../types/agentRuntime.js';

export type ToolCallRecord = {
  toolCallId: string;        // unique ID for this tool call
  sessionId: AgentSessionId;
  stepId: string;
  toolKind: string;
  argsHash: string;          // hash of normalized arguments
  result?: any;              // cached result
  completedAt: Date;
  executed: boolean;         // whether tool was actually executed
};

export type IdempotencyKey = string; // hash of sid + step_id + tool + normalized_args

export class IdempotencyManager {
  private records = new Map<IdempotencyKey, ToolCallRecord>();
  
  constructor() {}
  
  /**
   * Generate an idempotency key for a tool call
   */
  generateIdempotencyKey(sessionId: AgentSessionId, stepId: string, toolKind: string, args: any): IdempotencyKey {
    // Create a hash from the combination of identifiers
    const str = `${sessionId}:${stepId}:${toolKind}:${this.normalizeArgs(args)}`;
    return this.simpleHash(str);
  }
  
  /**
   * Check if a tool call has already been executed
   * Returns the cached result if exists, null if not executed yet
   */
  checkAndRecordExecution(idempotencyKey: IdempotencyKey, record: Omit<ToolCallRecord, 'completedAt'>): ToolCallRecord | null {
    const existing = this.records.get(idempotencyKey);
    
    if (existing) {
      // Tool call already exists, return cached result
      return existing;
    }
    
    // First time seeing this tool call, record it
    const newRecord: ToolCallRecord = {
      ...record,
      completedAt: new Date(),
    };
    
    this.records.set(idempotencyKey, newRecord);
    return null; // Indicates this is the first execution
  }
  
  /**
   * Get a previously executed tool call result
   */
  getExecutionResult(idempotencyKey: IdempotencyKey): ToolCallRecord | null {
    return this.records.get(idempotencyKey) || null;
  }
  
  /**
   * Mark a tool call as executed (if not already)
   */
  markAsExecuted(idempotencyKey: IdempotencyKey, result?: any): boolean {
    const record = this.records.get(idempotencyKey);
    
    if (!record) {
      // This shouldn't happen if checkAndRecordExecution was called first
      console.warn(`[IDEMPOTENCY] Attempted to mark non-existent record as executed: ${idempotencyKey}`);
      return false;
    }
    
    if (record.executed) {
      // Already executed
      return false;
    }
    
    // Update the record to mark as executed
    record.executed = true;
    record.result = result;
    record.completedAt = new Date();
    
    return true;
  }
  
  /**
   * Normalize tool arguments for consistent hashing
   */
  private normalizeArgs(args: any): string {
    if (args === null || args === undefined) {
      return 'null';
    }
    
    if (typeof args === 'string') {
      return args;
    }
    
    if (typeof args === 'object') {
      // Sort keys for consistent ordering
      const sortedKeys = Object.keys(args).sort();
      const pairs = sortedKeys.map(key => `${key}:${this.stringifyValue(args[key])}`);
      return `{${pairs.join(',')}}`;
    }
    
    return String(args);
  }
  
  private stringifyValue(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
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
}