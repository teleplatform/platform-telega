import { ok, fail } from "../llm/contract.js";
import { ObservabilityService } from "../../core/observability/observabilityService.js";
import { UsageLedger } from "../../core/cost/usageLedger.js";
import { BackpressureHandler } from "../../core/backpressure/backpressure.js";
import { LeaseManager } from "../../core/recovery/leaseManager.js";

// Global instance - in a real system this would be properly managed
let observabilityService: ObservabilityService | null = null;

function initializeObservabilityService(): ObservabilityService {
  if (!observabilityService) {
    const usageLedger = new UsageLedger();
    const backpressureHandler = new BackpressureHandler({ maxQueueDepth: 1000, maxActiveJobs: 50 });
    const leaseManager = new LeaseManager(30000, 10000);
    
    // Create a mock setInterval to prevent hanging during tests
    const originalSetInterval = (global as any).setInterval;
    (global as any).setInterval = () => ({ unref: () => {} });
    
    observabilityService = ObservabilityService.create(usageLedger, backpressureHandler, leaseManager);
    
    // Restore original setInterval
    (global as any).setInterval = originalSetInterval;
  }
  
  return observabilityService;
}

export async function registerAdminRoute(server: any) {
  // Dashboard overview
  server.get("/admin/dashboard", async (_req: any, reply: any) => {
    try {
      const service = initializeObservabilityService();
      const metrics = service.getAllMetrics();
      
      const dashboardData = {
        overview: {
          activeJobs: metrics.runtime.jobs_active,
          queueDepths: {
            interactive: metrics.runtime.queue_depth_interactive,
            batch: metrics.runtime.queue_depth_batch
          },
          denyRates: metrics.runtime.deny_rate,
          recoveryStats: {
            recoverableFound: metrics.recovery.recoverable_found,
            resumeSuccess: metrics.recovery.resume_success,
            resumeFail: metrics.recovery.resume_fail
          },
          gcStats: {
            lastRun: new Date().toISOString(),
            deletedJobs: metrics.storage.gc_deleted.jobs,
            deletedTraces: metrics.storage.gc_deleted.traces,
            deletedArtifacts: metrics.storage.gc_deleted.artifacts,
            durationMs: metrics.storage.gc_run_duration_ms
          },
          costTotals: {
            today: 125000, // Placeholder
            lastHour: 8500, // Placeholder
            byKind: metrics.billing.cost_micros_total
          }
        },
        lastUpdated: new Date().toISOString()
      };
      
      return reply.send(ok({ model: "system", tagUsed: "admin" }, dashboardData, "public"));
    } catch (e: any) {
      return reply.send(fail("dashboard_failed", { message: e?.message ?? "unknown" }));
    }
  });
  
  // Sessions explorer
  server.get("/admin/sessions", async (req: any, reply: any) => {
    try {
      const { timeWindow, subject, decision, rule, status } = req.query;
      
      // This would query the actual session store in a real implementation
      // For now, returning mock data
      const mockSessions = [
        {
          sid: 'sess-mock-001',
          jobId: 'job-mock-001',
          status: 'completed',
          lastEvent: 'receipt_generated',
          costTotal: 12500,
          createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
          sid: 'sess-mock-002',
          jobId: 'job-mock-002',
          status: 'denied',
          lastEvent: 'budget_exceeded',
          rule: 'budget',
          reason: 'Cost exceeded allocated budget',
          costTotal: 2500000,
          createdAt: new Date(Date.now() - 1800000).toISOString()
        },
        {
          sid: 'sess-mock-003',
          jobId: 'job-mock-003',
          status: 'running',
          lastEvent: 'model_call_completed',
          costTotal: 5600,
          createdAt: new Date(Date.now() - 600000).toISOString()
        }
      ];
      
      return reply.send(ok({ model: "system", tagUsed: "admin" }, { sessions: mockSessions, total: mockSessions.length }, "public"));
    } catch (e: any) {
      return reply.send(fail("sessions_list_failed", { message: e?.message ?? "unknown" }));
    }
  });
  
  // Single session detail
  server.get("/admin/session", async (req: any, reply: any) => {
    try {
      const { sid } = req.query;
      if (!sid) {
        return reply.send(fail("missing_sid", { message: "Session ID required" }));
      }
      
      const service = initializeObservabilityService();
      
      // Get explain and receipt data
      const explainData = service.getDecisionExplanation(sid);
      const receiptData = service.generateReceipt(sid);
      
      const sessionDetail = {
        sid,
        jobId: 'job-mock-detail',
        status: 'completed',
        timeline: [
          {
            timestamp: new Date(Date.now() - 300000).toISOString(),
            eventType: 'session_created',
            details: 'Session initiated by user-123'
          },
          {
            timestamp: new Date(Date.now() - 240000).toISOString(),
            eventType: 'model_call',
            details: 'Called gpt-4 with 1000 input tokens, 500 output tokens'
          },
          {
            timestamp: new Date(Date.now() - 180000).toISOString(),
            eventType: 'tool_call',
            details: 'Called net.fetch to https://api.example.com'
          },
          {
            timestamp: new Date(Date.now() - 120000).toISOString(),
            eventType: 'checkpoint_saved',
            details: 'Saved checkpoint at step 5'
          },
          {
            timestamp: new Date(Date.now() - 60000).toISOString(),
            eventType: 'session_completed',
            details: 'Session completed successfully'
          }
        ],
        explain: explainData,
        receipt: receiptData,
        recovery: {
          leases: [
            {
              id: 'lease-123',
              owner: 'worker-001',
              acquiredAt: new Date(Date.now() - 200000).toISOString(),
              expiresAt: new Date(Date.now() - 50000).toISOString(),
              active: false
            }
          ],
          checkpoints: [
            {
              stepId: 'step-5',
              timestamp: new Date(Date.now() - 120000).toISOString(),
              stateHash: 'sha256:abc123...'
            }
          ],
          resumeHistory: []
        },
        artifacts: [
          {
            id: 'artifact-logs-001',
            name: 'execution-logs.txt',
            sizeBytes: 10240,
            retentionTier: 'hot',
            ttlRemaining: 86400 // 24 hours
          },
          {
            id: 'artifact-trace-001',
            name: 'trace-data.json',
            sizeBytes: 5120,
            retentionTier: 'cold',
            ttlRemaining: 604800 // 7 days
          }
        ],
        createdAt: new Date(Date.now() - 300000).toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      return reply.send(ok({ model: "system", tagUsed: "admin" }, sessionDetail, "public"));
    } catch (e: any) {
      return reply.send(fail("session_detail_failed", { message: e?.message ?? "unknown" }));
    }
  });
  
  // Prometheus metrics endpoint
  server.get("/metrics", async (_req: any, reply: any) => {
    try {
      const service = initializeObservabilityService();
      const metrics = service.getPrometheusMetrics();
      
      reply.headers({
        "Content-Type": "text/plain"
      });
      
      return reply.send(metrics);
    } catch (e: any) {
      return reply.send(fail("metrics_failed", { message: e?.message ?? "unknown" }));
    }
  });
}