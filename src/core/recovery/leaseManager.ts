// Lease Manager - Recovery & Resume v1
// Manages execution leases and checkpoint tracking

import { AgentSessionId, AgentSessionState } from '../../types/agentRuntime.js';

export type LeaseInfo = {
  leaseOwner: string;        // worker/instance ID
  leaseExpiresAt: Date;      // when lease expires
  leaseAcquiredAt: Date;     // when lease was acquired
  lastHeartbeatAt: Date;     // last heartbeat time
  checkpointStepId?: string; // last completed step
  checkpointStateHash?: string; // hash of state at checkpoint
  checkpointTimestamp?: Date; // when checkpoint was created
};

export type ResumeState = 'RUNNING' | 'RECOVERABLE' | 'TERMINAL';

export class LeaseManager {
  private leases = new Map<AgentSessionId, LeaseInfo>();
  private readonly leaseDurationMs: number;
  private readonly heartbeatIntervalMs: number;
  
  constructor(leaseDurationMs: number = 30000, heartbeatIntervalMs: number = 10000) { // 30s lease, 10s heartbeat
    this.leaseDurationMs = leaseDurationMs;
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    
    // Start lease cleanup interval
    setInterval(() => {
      this.cleanupExpiredLeases();
    }, this.heartbeatIntervalMs);
  }
  
  /**
   * Atomically acquire a lease for a job
   * Returns true if successful, false if already leased by another worker
   */
  acquireLease(sessionId: AgentSessionId, workerId: string): boolean {
    const existingLease = this.leases.get(sessionId);
    
    // If no lease exists or lease is expired, acquire it
    if (!existingLease || this.isLeaseExpired(existingLease)) {
      this.leases.set(sessionId, {
        leaseOwner: workerId,
        leaseExpiresAt: new Date(Date.now() + this.leaseDurationMs),
        leaseAcquiredAt: new Date(),
        lastHeartbeatAt: new Date(),
        checkpointStepId: existingLease?.checkpointStepId,
        checkpointStateHash: existingLease?.checkpointStateHash,
        checkpointTimestamp: existingLease?.checkpointTimestamp,
      });
      return true;
    }
    
    // Lease exists and is not expired - cannot acquire
    return false;
  }
  
  /**
   * Renew a lease (heartbeat)
   * Returns true if successful, false if lease doesn't belong to this worker
   */
  heartbeat(sessionId: AgentSessionId, workerId: string): boolean {
    const lease = this.leases.get(sessionId);
    
    if (!lease) {
      return false; // No lease exists
    }
    
    if (lease.leaseOwner !== workerId) {
      return false; // Lease belongs to another worker
    }
    
    // Renew lease
    lease.leaseExpiresAt = new Date(Date.now() + this.leaseDurationMs);
    lease.lastHeartbeatAt = new Date();
    
    return true;
  }
  
  /**
   * Release a lease when job completes
   */
  releaseLease(sessionId: AgentSessionId, workerId: string): boolean {
    const lease = this.leases.get(sessionId);
    
    if (!lease) {
      return false; // No lease exists
    }
    
    if (lease.leaseOwner !== workerId) {
      return false; // Lease belongs to another worker
    }
    
    // Remove the lease
    this.leases.delete(sessionId);
    return true;
  }
  
  /**
   * Update checkpoint information
   */
  updateCheckpoint(sessionId: AgentSessionId, workerId: string, stepId: string, stateHash: string): boolean {
    const lease = this.leases.get(sessionId);
    
    if (!lease) {
      return false; // No lease exists
    }
    
    if (lease.leaseOwner !== workerId) {
      return false; // Lease belongs to another worker
    }
    
    // Only update if the new checkpoint is for a later step (monotonic)
    if (!lease.checkpointStepId || this.compareStepIds(stepId, lease.checkpointStepId) > 0) {
      lease.checkpointStepId = stepId;
      lease.checkpointStateHash = stateHash;
      lease.checkpointTimestamp = new Date();
      return true;
    }
    
    return false; // Step is not newer, don't update
  }
  
  /**
   * Get lease information for a session
   */
  getLease(sessionId: AgentSessionId): LeaseInfo | null {
    return this.leases.get(sessionId) || null;
  }
  
  /**
   * Check if a session is recoverable (RUNNING without active lease)
   */
  isRecoverable(sessionId: AgentSessionId, currentState: AgentSessionState): boolean {
    const lease = this.leases.get(sessionId);
    
    // If there's no lease, it's not recoverable (either never started or already completed)
    if (!lease) {
      return false;
    }
    
    // Only RUNNING sessions can become recoverable
    if (currentState !== 'running') {
      return false;
    }
    
    // Session is recoverable if lease is expired
    return this.isLeaseExpired(lease);
  }
  
  /**
   * Get all sessions that are currently recoverable
   */
  getRecoverableSessions(currentStates: Map<AgentSessionId, AgentSessionState>): AgentSessionId[] {
    const recoverable: AgentSessionId[] = [];
    
    const entries = Array.from(this.leases.entries());
    for (const [sessionId, lease] of entries) {
      const currentState = currentStates.get(sessionId);
      
      if (currentState && this.isRecoverable(sessionId, currentState)) {
        recoverable.push(sessionId);
      }
    }
    
    return recoverable;
  }
  
  private isLeaseExpired(lease: LeaseInfo): boolean {
    return lease.leaseExpiresAt < new Date();
  }
  
  private cleanupExpiredLeases(): void {
    const entries = Array.from(this.leases.entries());
    for (const [sessionId, lease] of entries) {
      if (this.isLeaseExpired(lease)) {
        // Lease expired, mark as recoverable by leaving it in the map
        // The session state should transition to RECOVERABLE externally
        console.log(`[LEASE] Lease expired for session ${sessionId}, now recoverable`);
      }
    }
  }
  
  private compareStepIds(stepA: string, stepB: string): number {
    // Simple comparison based on string values
    // In a real system, you might want more sophisticated ordering
    if (stepA < stepB) return -1;
    if (stepA > stepB) return 1;
    return 0;
  }
}