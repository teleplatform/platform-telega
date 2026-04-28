// Usage Ledger - Cost Accounting v1
// Append-only ledger for tracking all costs

import { AgentSessionId, Subject } from '../../types/agentRuntime.js';

export type CostUnit = 'tokens' | 'calls' | 'bytes' | 'seconds' | 'milliseconds' | 'microseconds';
export type CostKind = 'model' | 'tool' | 'storage' | 'compute';

export type LedgerEntry = {
  id: string;                    // Unique entry ID
  timestamp: Date;              // When the cost was recorded
  subject: Subject;             // Who incurred the cost
  sessionId: AgentSessionId;    // Which session
  jobId?: string;               // Which job (optional)
  stepId?: string;              // Which step (optional)
  kind: CostKind;               // What type of cost
  units: number;                // Quantity of units consumed
  unitType: CostUnit;           // Type of unit (tokens, calls, bytes, etc.)
  costMicros: number;           // Cost in micro-units (1/1,000,000 of main currency)
  idempotencyKey: string;       // Key to prevent duplicate entries
  metadata: Record<string, any>; // Additional context
};

export class UsageLedger {
  private entries: LedgerEntry[] = [];
  private idempotencyKeys = new Set<string>(); // Prevent duplicate entries
  
  constructor() {}
  
  /**
   * Record a cost entry to the ledger (append-only)
   */
  recordEntry(entry: Omit<LedgerEntry, 'id' | 'timestamp'>): boolean {
    // Check for idempotency - don't record the same entry twice
    if (this.idempotencyKeys.has(entry.idempotencyKey)) {
      console.log(`[LEDGER] Duplicate entry prevented: ${entry.idempotencyKey}`);
      return false; // Entry already exists
    }
    
    // Create the complete entry
    const completeEntry: LedgerEntry = {
      ...entry,
      id: `ledger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    
    // Add to ledger
    this.entries.push(completeEntry);
    
    // Track the idempotency key
    this.idempotencyKeys.add(entry.idempotencyKey);
    
    return true;
  }
  
  /**
   * Get all entries for a specific session
   */
  getEntriesForSession(sessionId: AgentSessionId): LedgerEntry[] {
    return this.entries.filter(entry => entry.sessionId === sessionId);
  }
  
  /**
   * Get all entries for a specific job
   */
  getEntriesForJob(jobId: string): LedgerEntry[] {
    return this.entries.filter(entry => entry.jobId === jobId);
  }
  
  /**
   * Get all entries for a specific subject
   */
  getEntriesForSubject(subject: Subject): LedgerEntry[] {
    return this.entries.filter(entry => entry.subject === subject);
  }
  
  /**
   * Calculate total cost for a session
   */
  calculateSessionTotal(sessionId: AgentSessionId): number {
    const sessionEntries = this.getEntriesForSession(sessionId);
    return sessionEntries.reduce((sum, entry) => sum + entry.costMicros, 0);
  }
  
  /**
   * Calculate total cost for a job
   */
  calculateJobTotal(jobId: string): number {
    const jobEntries = this.getEntriesForJob(jobId);
    return jobEntries.reduce((sum, entry) => sum + entry.costMicros, 0);
  }
  
  /**
   * Calculate total cost for a subject
   */
  calculateSubjectTotal(subject: Subject): number {
    const subjectEntries = this.getEntriesForSubject(subject);
    return subjectEntries.reduce((sum, entry) => sum + entry.costMicros, 0);
  }
  
  /**
   * Calculate total cost by kind for a session
   */
  calculateSessionTotalByKind(sessionId: AgentSessionId, kind: CostKind): number {
    const sessionEntries = this.getEntriesForSession(sessionId);
    return sessionEntries
      .filter(entry => entry.kind === kind)
      .reduce((sum, entry) => sum + entry.costMicros, 0);
  }
  
  /**
   * Get ledger entries with optional filters
   */
  getEntries(filters?: {
    subject?: Subject;
    sessionId?: AgentSessionId;
    jobId?: string;
    kind?: CostKind;
    startDate?: Date;
    endDate?: Date;
  }): LedgerEntry[] {
    let filteredEntries = [...this.entries];
    
    if (filters) {
      if (filters.subject !== undefined) {
        filteredEntries = filteredEntries.filter(e => e.subject === filters.subject);
      }
      if (filters.sessionId !== undefined) {
        filteredEntries = filteredEntries.filter(e => e.sessionId === filters.sessionId);
      }
      if (filters.jobId !== undefined) {
        filteredEntries = filteredEntries.filter(e => e.jobId === filters.jobId);
      }
      if (filters.kind !== undefined) {
        filteredEntries = filteredEntries.filter(e => e.kind === filters.kind);
      }
      if (filters.startDate != null) {
        filteredEntries = filteredEntries.filter(e => e.timestamp >= filters.startDate!);
      }
      if (filters.endDate != null) {
        filteredEntries = filteredEntries.filter(e => e.timestamp <= filters.endDate!);
      }
    }
    
    return filteredEntries;
  }

  /**
   * Get a receipt-style breakdown for a session
   */
  getReceipt(sessionId: AgentSessionId): {
    sessionId: AgentSessionId;
    entries: LedgerEntry[];
    totals: {
      model: number;
      tool: number;
      storage: number;
      compute: number;
      total: number;
    };
    breakdown: {
      kind: CostKind;
      unitType: CostUnit;
      totalUnits: number;
      totalCost: number;
    }[];
  } {
    const entries = this.getEntriesForSession(sessionId);
    
    // Calculate totals by kind
    const totals = {
      model: this.calculateSessionTotalByKind(sessionId, 'model'),
      tool: this.calculateSessionTotalByKind(sessionId, 'tool'),
      storage: this.calculateSessionTotalByKind(sessionId, 'storage'),
      compute: this.calculateSessionTotalByKind(sessionId, 'compute'),
      total: this.calculateSessionTotal(sessionId),
    };
    
    // Create breakdown by kind and unit type
    const breakdownMap = new Map<string, {
      kind: CostKind;
      unitType: CostUnit;
      totalUnits: number;
      totalCost: number;
    }>();
    
    for (const entry of entries) {
      const key = `${entry.kind}-${entry.unitType}`;
      if (!breakdownMap.has(key)) {
        breakdownMap.set(key, {
          kind: entry.kind,
          unitType: entry.unitType,
          totalUnits: 0,
          totalCost: 0,
        });
      }
      
      const breakdown = breakdownMap.get(key)!;
      breakdown.totalUnits += entry.units;
      breakdown.totalCost += entry.costMicros;
    }
    
    const breakdown = Array.from(breakdownMap.values());
    
    return {
      sessionId,
      entries,
      totals,
      breakdown,
    };
  }
  
  /**
   * Get total entries count
   */
  getEntryCount(): number {
    return this.entries.length;
  }
  
  /**
   * Clear the ledger (for testing purposes only)
   */
  clear(): void {
    this.entries = [];
    this.idempotencyKeys.clear();
  }
}