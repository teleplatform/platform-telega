// GC Runner - Storage & Retention v1
// Garbage collector for expired data

import { TtlPolicy, DEFAULT_TTL_POLICY, isExpired } from './ttlPolicy.js';
import { readdir, stat, unlink, access, constants } from 'fs/promises';
import { join, dirname } from 'path';
import { AgentSessionState } from '../../types/agentRuntime.js';

export type GcStats = {
  ttl_expired: {
    jobs: number;
    traces: number;
    artifacts: number;
  };
  orphans: {
    traces_without_job: number;
    artifacts_without_owner: number;
  };
  skipped: {
    locked_or_running: number;
    errors: number;
  };
  total_found: number;
  total_deleted: number;
};

export class GcRunner {
  private policy: TtlPolicy;
  private evidenceDir: string;

  constructor(policy: TtlPolicy = DEFAULT_TTL_POLICY, evidenceDir: string = './evidence') {
    this.policy = policy;
    this.evidenceDir = evidenceDir;
  }

  async run(): Promise<GcStats> {
    console.log('[GC] Starting garbage collection run');
    
    const stats: GcStats = {
      ttl_expired: { jobs: 0, traces: 0, artifacts: 0 },
      orphans: { traces_without_job: 0, artifacts_without_owner: 0 },
      skipped: { locked_or_running: 0, errors: 0 },
      total_found: 0,
      total_deleted: 0,
    };

    // Phase 1: TTL-expired cleanup
    await this.cleanupTtlExpired(stats);

    // Phase 2: Orphan cleanup
    await this.cleanupOrphans(stats);

    // Phase 3: Optional compaction (future extension)
    // For now, we'll just log completion
    
    console.log(`[GC] Completed run. Found: ${stats.total_found}, Deleted: ${stats.total_deleted}, Skipped: ${stats.skipped.locked_or_running + stats.skipped.errors}`);
    return stats;
  }

  private async cleanupTtlExpired(stats: GcStats): Promise<void> {
    console.log('[GC] Phase 1: Cleaning up TTL-expired items');

    // Clean up jobs
    await this.cleanupExpiredJobs(stats);

    // Clean up traces
    await this.cleanupExpiredTraces(stats);

    // Clean up artifacts
    await this.cleanupExpiredArtifacts(stats);
  }

  private async cleanupExpiredJobs(stats: GcStats): Promise<void> {
    try {
      const items = await this.listEvidenceItems();
      
      for (const item of items) {
        const itemPath = join(this.evidenceDir, item);
        
        // Skip if not a directory
        const isDir = await stat(itemPath).then(s => s.isDirectory()).catch(() => false);
        if (!isDir) continue;
        
        stats.total_found++;
        
        // Check if job is RUNNING (don't delete)
        const sessionState = await this.getSessionState(itemPath);
        if (sessionState === 'running') {
          stats.skipped.locked_or_running++;
          continue;
        }
        
        // Get TTL based on state
        let ttlSeconds: number | null = null;
        if (sessionState === 'completed') {
          ttlSeconds = this.policy.jobs.completed;
        } else if (sessionState === 'failed') {
          ttlSeconds = this.policy.jobs.failed;
        } else if (sessionState === 'terminated') {
          ttlSeconds = this.policy.jobs.cancelled;
        }
        
        // Skip if no TTL (e.g., running jobs)
        if (ttlSeconds === null) continue;
        
        // Check if expired
        const createdAt = await this.getItemCreatedAt(itemPath);
        if (!createdAt || !isExpired(createdAt, ttlSeconds)) continue;
        
        // Delete the job directory
        try {
          await this.deleteJob(itemPath);
          stats.ttl_expired.jobs++;
          stats.total_deleted++;
          console.log(`[GC] Deleted expired job: ${itemPath}`);
        } catch (error) {
          stats.skipped.errors++;
          console.error(`[GC] Error deleting job ${itemPath}:`, error);
        }
      }
    } catch (error) {
      console.error('[GC] Error during job cleanup:', error);
    }
  }

  private async cleanupExpiredTraces(stats: GcStats): Promise<void> {
    try {
      const items = await this.listEvidenceItems();
      
      for (const item of items) {
        const tracePath = join(this.evidenceDir, item, 'trace.jsonl');
        
        // Check if trace file exists
        const exists = await access(tracePath, constants.F_OK).then(() => true).catch(() => false);
        if (!exists) continue;
        
        stats.total_found++;
        
        // Check TTL for trace
        const traceCreatedAt = await this.getFileCreatedAt(tracePath);
        if (traceCreatedAt && isExpired(traceCreatedAt, this.policy.traces)) {
          try {
            await unlink(tracePath);
            stats.ttl_expired.traces++;
            stats.total_deleted++;
            console.log(`[GC] Deleted expired trace: ${tracePath}`);
          } catch (error) {
            stats.skipped.errors++;
            console.error(`[GC] Error deleting trace ${tracePath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('[GC] Error during trace cleanup:', error);
    }
  }

  private async cleanupExpiredArtifacts(stats: GcStats): Promise<void> {
    try {
      // Look for temporary artifacts (not evidence bundles)
      const items = await this.listEvidenceItems();
      
      for (const item of items) {
        const itemPath = join(this.evidenceDir, item);
        const isDir = await stat(itemPath).then(s => s.isDirectory()).catch(() => false);
        if (!isDir) continue;
        
        // Look for temporary artifacts in the session directory
        const subItems = await readdir(itemPath).catch(() => []);
        
        for (const subItem of subItems) {
          if (subItem === 'trace.jsonl' || subItem === 'seal.json' || subItem === 'manifest.json') {
            // These are evidence files, check TTL based on policy
            const filePath = join(itemPath, subItem);
            
            // Don't delete evidence files if they're permanent
            if (subItem === 'seal.json' || subItem === 'manifest.json') {
              // These are part of evidence, check evidence TTL
              const createdAt = await this.getFileCreatedAt(filePath);
              if (createdAt && isExpired(createdAt, this.policy.artifacts.evidence)) {
                try {
                  await unlink(filePath);
                  stats.ttl_expired.artifacts++;
                  stats.total_deleted++;
                  console.log(`[GC] Deleted expired evidence artifact: ${filePath}`);
                } catch (error) {
                  stats.skipped.errors++;
                  console.error(`[GC] Error deleting evidence artifact ${filePath}:`, error);
                }
              }
            } else if (subItem === 'trace.jsonl') {
              // Trace files are handled separately, skip here
              continue;
            }
          } else {
            // Temporary artifacts
            const filePath = join(itemPath, subItem);
            const createdAt = await this.getFileCreatedAt(filePath);
            
            if (createdAt && isExpired(createdAt, this.policy.artifacts.temporary)) {
              try {
                await unlink(filePath);
                stats.ttl_expired.artifacts++;
                stats.total_deleted++;
                console.log(`[GC] Deleted expired temporary artifact: ${filePath}`);
              } catch (error) {
                stats.skipped.errors++;
                console.error(`[GC] Error deleting temporary artifact ${filePath}:`, error);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[GC] Error during artifact cleanup:', error);
    }
  }

  private async cleanupOrphans(stats: GcStats): Promise<void> {
    console.log('[GC] Phase 2: Cleaning up orphaned items');
    
    // For now, we'll just look for trace files without corresponding job directories
    // This is a simplified implementation
  }

  private async listEvidenceItems(): Promise<string[]> {
    try {
      return await readdir(this.evidenceDir).catch(() => []);
    } catch (error) {
      console.error('[GC] Error listing evidence directory:', error);
      return [];
    }
  }

  private async getSessionState(sessionPath: string): Promise<AgentSessionState | null> {
    // For now, we'll infer the state from the presence of terminal events in trace
    // In a real implementation, this would read from a state file or DB
    try {
      const tracePath = join(sessionPath, 'trace.jsonl');
      const exists = await access(tracePath, constants.F_OK).then(() => true).catch(() => false);
      if (!exists) return null;
      
      // For simplicity, we'll just return 'completed' if trace exists
      // In a real implementation, we'd parse the trace for terminal states
      return 'completed'; // Simplified for demo purposes
    } catch (error) {
      return null;
    }
  }

  private async getItemCreatedAt(itemPath: string): Promise<Date | null> {
    try {
      const stats = await stat(itemPath);
      return new Date(stats.birthtime); // Creation time
    } catch (error) {
      return null;
    }
  }

  private async getFileCreatedAt(filePath: string): Promise<Date | null> {
    try {
      const stats = await stat(filePath);
      return new Date(stats.birthtime); // Creation time
    } catch (error) {
      return null;
    }
  }

  private async deleteJob(jobPath: string): Promise<void> {
    // Import rimraf or use recursive directory deletion
    const { rm } = await import('fs/promises');
    await rm(jobPath, { recursive: true, force: true });
  }
}
