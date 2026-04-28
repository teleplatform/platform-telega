// Admin API Routes - Mission Control v1
// Provides read-only access to system state and session details

import { NextRequest } from 'next/server';
import { ObservabilityService } from '../../../core/observability/observabilityService.js';
import { UsageLedger } from '../../../core/cost/usageLedger.js';
import { BackpressureHandler } from '../../../core/backpressure/backpressure.js';
import { LeaseManager } from '../../../core/recovery/leaseManager.js';

// Mock services for now - these would be injected in a real system
let observabilityService: ObservabilityService;

// Initialize services if not already done
if (!observabilityService) {
  const usageLedger = new UsageLedger();
  const backpressureHandler = new BackpressureHandler({ maxQueueDepth: 1000, maxActiveJobs: 50 });
  const leaseManager = new LeaseManager(30000, 10000);
  
  // Disable interval for testing
  (global as any).setInterval = () => ({});
  
  observabilityService = ObservabilityService.create(usageLedger, backpressureHandler, leaseManager);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  
  try {
    switch (path) {
      case '/dashboard':
        return Response.json(getDashboardData());
        
      case '/sessions':
        const timeWindow = searchParams.get('timeWindow') || '24h';
        const subject = searchParams.get('subject') || undefined;
        const decision = searchParams.get('decision') || undefined;
        const rule = searchParams.get('rule') || undefined;
        const status = searchParams.get('status') || undefined;
        
        return Response.json(getSessionsList({
          timeWindow,
          subject,
          decision,
          rule,
          status
        }));
        
      case '/session':
        const sessionId = searchParams.get('sid');
        if (!sessionId) {
          return Response.json({ error: 'Session ID required' }, { status: 400 });
        }
        
        return Response.json(getSessionDetails(sessionId));
        
      case '/metrics':
        return new Response(observabilityService.getPrometheusMetrics(), {
          headers: { 'Content-Type': 'text/plain' }
        });
        
      default:
        return Response.json({ error: 'Unknown path' }, { status: 404 });
    }
  } catch (error) {
    console.error('Admin API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type DashboardData = {
  overview: {
    activeJobs: number;
    queueDepths: {
      interactive: number;
      batch: number;
    };
    denyRates: Record<string, number>;
    recoveryStats: {
      recoverableFound: number;
      resumeSuccess: number;
      resumeFail: number;
    };
    gcStats: {
      lastRun: string;
      deletedJobs: number;
      deletedTraces: number;
      deletedArtifacts: number;
      durationMs: number;
    };
    costTotals: {
      today: number;
      lastHour: number;
      byKind: Record<string, number>;
    };
  };
  lastUpdated: string;
};

function getDashboardData(): DashboardData {
  const metrics = observabilityService.getAllMetrics();
  
  return {
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
}

type SessionFilter = {
  timeWindow: string;
  subject?: string;
  decision?: string;
  rule?: string;
  status?: string;
};

type SessionListItem = {
  sid: string;
  jobId?: string;
  status: string;
  lastEvent: string;
  rule?: string;
  reason?: string;
  costTotal: number;
  createdAt: string;
};

function getSessionsList(filters: SessionFilter): { sessions: SessionListItem[]; total: number } {
  // This would query the actual session store in a real implementation
  // For now, returning mock data
  const mockSessions: SessionListItem[] = [
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
  
  return {
    sessions: mockSessions,
    total: mockSessions.length
  };
}

type SessionDetail = {
  sid: string;
  jobId?: string;
  status: string;
  timeline: Array<{
    timestamp: string;
    eventType: string;
    details: string;
  }>;
  explain: any; // Would be DecisionResponse type
  receipt: any; // Would be ReceiptResponse type
  recovery: {
    leases: Array<any>;
    checkpoints: Array<any>;
    resumeHistory: Array<any>;
  };
  artifacts: Array<{
    id: string;
    name: string;
    sizeBytes: number;
    retentionTier: string;
    ttlRemaining: number; // seconds
  }>;
  createdAt: string;
  updatedAt: string;
};

function getSessionDetails(sessionId: string): SessionDetail {
  // This would query the actual session store in a real implementation
  // For now, returning mock data with embedded explain and receipt data
  
  // Get explain and receipt data
  const explainData = observabilityService.getDecisionExplanation(sessionId);
  const receiptData = observabilityService.generateReceipt(sessionId);
  
  return {
    sid: sessionId,
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
}