// Recovery Coordinator - Recovery & Resume v1
// Coordinates lease management, checkpoints, and idempotency

import { AgentSessionId, AgentSessionState, AgentSession } from '../../types/agentRuntime.js';
import { LeaseManager } from './leaseManager.js';
import { IdempotencyManager, type ToolCallRecord } from './idempotencyManager.js';

export type ResumeContext = {
  sessionId: AgentSessionId;
  checkpointStepId?: string;
  checkpointStateHash?: string;
  checkpointTimestamp?: Date;
};

export type RecoveryStats = {
  recoverableSessions: number;
  resumedSessions: number;
  idempotentOperations: number;
  preventedDuplicates: number;
};

export class RecoveryCoordinator {
  private leaseManager: LeaseManager;
  private idempotencyManager: IdempotencyManager;
  private workerId: string;
  private stats: RecoveryStats;
  
  constructor(workerId: string, leaseDurationMs: number = 30000, heartbeatIntervalMs: number = 10000) {
    this.workerId = workerId;
    this.leaseManager = new LeaseManager(leaseDurationMs, heartbeatIntervalMs);
    this.idempotencyManager = new IdempotencyManager();
    this.stats = {
      recoverableSessions: 0,
      resumedSessions: 0,
      idempotentOperations: 0,
      preventedDuplicates: 0,
    };
  }
  
  /**
   * Attempt to acquire a session for execution (lease-based ownership)
   */
  acquireSession(sessionId: AgentSessionId): boolean {
    return this.leaseManager.acquireLease(sessionId, this.workerId);
  }
  
  /**
   * Heartbeat to maintain lease ownership
   */
  heartbeat(sessionId: AgentSessionId): boolean {
    return this.leaseManager.heartbeat(sessionId, this.workerId);
  }
  
  /**
   * Release lease when session completes
   */
  releaseSession(sessionId: AgentSessionId): boolean {
    return this.leaseManager.releaseLease(sessionId, this.workerId);
  }
  
  /**
   * Update checkpoint information after successful step completion
   */
  updateCheckpoint(sessionId: AgentSessionId, stepId: string, stateHash: string): boolean {
    return this.leaseManager.updateCheckpoint(sessionId, this.workerId, stepId, stateHash);
  }
  
  /**
   * Get resume context for a session
   */
  getResumeContext(sessionId: AgentSessionId): ResumeContext | null {
    const lease = this.leaseManager.getLease(sessionId);
    if (!lease) {
      return null;
    }
    
    return {
      sessionId,
      checkpointStepId: lease.checkpointStepId,
      checkpointStateHash: lease.checkpointStateHash,
      checkpointTimestamp: lease.checkpointTimestamp,
    };
  }
  
  /**
   * Check if a session is recoverable (RUNNING without active lease)
   */
  isSessionRecoverable(sessionId: AgentSessionId, currentState: AgentSessionState): boolean {
    return this.leaseManager.isRecoverable(sessionId, currentState);
  }
  
  /**
   * Get all recoverable sessions
   */
  getRecoverableSessions(sessions: AgentSession[]): AgentSessionId[] {
    const currentStates = new Map<AgentSessionId, AgentSessionState>();
    for (const session of sessions) {
      currentStates.set(session.sid, session.state);
    }
    
    return this.leaseManager.getRecoverableSessions(currentStates);
  }
  
  /**
   * Check for idempotency and prevent duplicate tool executions
   */
  checkToolIdempotency(
    sessionId: AgentSessionId,
    stepId: string,
    toolKind: string,
    args: any
  ): { alreadyExecuted: boolean; result?: any } {
    const idempotencyKey = this.idempotencyManager.generateIdempotencyKey(
      sessionId,
      stepId,
      toolKind,
      args
    );
    
    const existingRecord = this.idempotencyManager.getExecutionResult(idempotencyKey);
    
    if (existingRecord) {
      // Tool call already executed, return cached result
      this.stats.preventedDuplicates++;
      return { alreadyExecuted: true, result: existingRecord.result };
    }
    
    // Tool call hasn't been executed yet, return false to proceed
    this.stats.idempotentOperations++;
    return { alreadyExecuted: false };
  }
  
  /**
   * Record a tool execution to prevent duplicates
   */
  recordToolExecution(
    sessionId: AgentSessionId,
    stepId: string,
    toolKind: string,
    args: any,
    result?: any
  ): void {
    const idempotencyKey = this.idempotencyManager.generateIdempotencyKey(
      sessionId,
      stepId,
      toolKind,
      args
    );
    
    // Create a record for this tool call
    const record: Omit<ToolCallRecord, 'completedAt'> = {
      toolCallId: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      stepId,
      toolKind,
      argsHash: this.idempotencyManager.generateIdempotencyKey(sessionId, stepId, toolKind, args),
      result,
      executed: true,
    };
    
    // This will either create a new record or update existing one
    this.idempotencyManager.checkAndRecordExecution(idempotencyKey, record);
  }
  
  /**
   * Resume a session from checkpoint
   */
  resumeSession(sessionId: AgentSessionId): ResumeContext | null {
    // First try to acquire lease for this session
    if (!this.acquireSession(sessionId)) {
      // Could not acquire lease, session is owned by another worker
      return null;
    }
    
    // Get the resume context
    const context = this.getResumeContext(sessionId);
    if (context) {
      this.stats.resumedSessions++;
    }
    
    return context;
  }
  
  /**
   * Get recovery statistics
   */
  getStats(): RecoveryStats {
    return { ...this.stats };
  }
  
  /**
   * Perform recovery sweep - find and resume recoverable sessions
   */
  performRecoverySweep(sessions: AgentSession[]): ResumeContext[] {
    const recoverableSessions = this.getRecoverableSessions(sessions);
    const resumedContexts: ResumeContext[] = [];
    
    this.stats.recoverableSessions = recoverableSessions.length;
    
    for (const sessionId of recoverableSessions) {
      const context = this.resumeSession(sessionId);
      if (context) {
        resumedContexts.push(context);
      }
    }
    
    return resumedContexts;
  }
}