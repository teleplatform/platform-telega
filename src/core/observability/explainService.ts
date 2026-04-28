// Explain Service - Observability v1
// Provides human-readable explanations for system decisions

import { AgentSessionId } from '../../types/agentRuntime.js';
import { UsageLedger } from '../cost/usageLedger.js';
import { BackpressureHandler } from '../backpressure/backpressure.js';
import { LeaseManager } from '../recovery/leaseManager.js';

export type DecisionRule = 
  | 'rate_limit' 
  | 'quota' 
  | 'backpressure' 
  | 'budget' 
  | 'tool_budget'
  | 'recovery'
  | 'max_steps'
  | 'timeout'
  | 'concurrency_limit'
  | 'system_normal';

export type DecisionResponse = {
  decision: 'allow' | 'deny' | 'stop';
  rule: DecisionRule;
  reasonCode: string;
  humanSummary: string;
  evidence: {
    traceIds?: string[];
    timestamps?: Date[];
    lastPolicyEvents?: string[];
    queueDepth?: number;
    activeJobs?: number;
    costSoFar?: number;
    budget?: number;
  };
  suggestedFix: string[];
};

export type TraceEvent = {
  id: string;
  timestamp: Date;
  eventType: string;
  sessionId: AgentSessionId;
  jobId?: string;
  stepId?: string;
  metadata: Record<string, any>;
};

export class ExplainService {
  private usageLedger: UsageLedger;
  private backpressureHandler: BackpressureHandler;
  private leaseManager: LeaseManager;
  private traceEvents: TraceEvent[] = [];
  
  constructor(
    usageLedger: UsageLedger,
    backpressureHandler: BackpressureHandler,
    leaseManager: LeaseManager
  ) {
    this.usageLedger = usageLedger;
    this.backpressureHandler = backpressureHandler;
    this.leaseManager = leaseManager;
  }
  
  /**
   * Get explanation for a decision made about a session
   */
  getDecisionExplanation(sessionId: AgentSessionId, jobId?: string): DecisionResponse {
    // Look for recent policy events related to this session
    const sessionEvents = this.getSessionEvents(sessionId, jobId);
    const recentDenyEvents = sessionEvents.filter(e => 
      e.eventType.includes('deny') || e.eventType.includes('reject') || e.eventType.includes('stop')
    ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (recentDenyEvents.length > 0) {
      const lastDenyEvent = recentDenyEvents[0];
      return this.createExplanationFromEvent(lastDenyEvent);
    }
    
    // Check various system states that might lead to denials
    const backpressureStats = this.backpressureHandler.getStats();
    const totalQueueDepth = backpressureStats.interactive.pending + backpressureStats.batch.pending;
    const totalActive = backpressureStats.interactive.active + backpressureStats.batch.active;
    
    // Check if session is in backpressure state
    if (totalQueueDepth > 800) { // Assuming max queue depth is 1000, 80% threshold
      return {
        decision: 'deny',
        rule: 'backpressure',
        reasonCode: 'queue_depth_threshold_exceeded',
        humanSummary: `Session was denied due to system overload. Queue depth (${totalQueueDepth}) exceeded safe threshold.`,
        evidence: {
          queueDepth: totalQueueDepth,
          activeJobs: totalActive,
          timestamps: [new Date()],
          lastPolicyEvents: ['backpressure_detected']
        },
        suggestedFix: [
          'Retry after a brief delay',
          'Reduce concurrent requests',
          'Contact support if problem persists'
        ]
      };
    }
    
    // Check if budget exceeded
    if (jobId) {
      const currentCost = this.usageLedger.calculateJobTotal(jobId);
      // Note: In a real system, we'd have access to the job's budget
      // For now, we'll simulate checking if cost is unusually high
      if (currentCost > 1_000_000) { // 1 Teleton
        return {
          decision: 'deny',
          rule: 'budget',
          reasonCode: 'budget_exceeded',
          humanSummary: `Job budget exceeded. Current cost: ${currentCost} micros.`,
          evidence: {
            costSoFar: currentCost,
            timestamps: [new Date()]
          },
          suggestedFix: [
            'Check for infinite loops in agent behavior',
            'Increase job budget if legitimate usage',
            'Optimize agent to use fewer resources'
          ]
        };
      }
    }
    
    // If no denial detected, return allow explanation
    return {
      decision: 'allow',
      rule: 'system_normal',
      reasonCode: 'no_denial_detected',
      humanSummary: 'Session is allowed to proceed normally.',
      evidence: {
        queueDepth: totalQueueDepth,
        activeJobs: totalActive,
        timestamps: [new Date()]
      },
      suggestedFix: []
    };
  }
  
  /**
   * Add a trace event for later analysis
   */
  addTraceEvent(event: Omit<TraceEvent, 'id' | 'timestamp'>): string {
    const traceEvent: TraceEvent = {
      ...event,
      id: `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };
    
    this.traceEvents.push(traceEvent);
    return traceEvent.id;
  }
  
  private getSessionEvents(sessionId: AgentSessionId, jobId?: string): TraceEvent[] {
    return this.traceEvents.filter(event => 
      event.sessionId === sessionId && 
      (!jobId || event.jobId === jobId)
    );
  }
  
  private createExplanationFromEvent(event: TraceEvent): DecisionResponse {
    let rule: DecisionRule = 'recovery';
    let reasonCode = 'unknown_event';
    let humanSummary = 'An event occurred that affected the session.';
    let suggestedFix: string[] = [];
    
    // Determine the rule based on event type
    if (event.eventType.includes('rate_limit')) {
      rule = 'rate_limit';
      reasonCode = 'rate_limit_exceeded';
      humanSummary = 'Request rate exceeded allowed limits.';
      suggestedFix = ['Slow down request frequency', 'Check rate limit settings'];
    } else if (event.eventType.includes('budget') || event.eventType.includes('cost')) {
      rule = 'budget';
      reasonCode = 'budget_exceeded';
      humanSummary = 'Budget limit reached.';
      suggestedFix = ['Increase budget allocation', 'Optimize usage'];
    } else if (event.eventType.includes('backpressure')) {
      rule = 'backpressure';
      reasonCode = 'system_overload';
      humanSummary = 'System is overloaded, request rejected.';
      suggestedFix = ['Retry after delay', 'Reduce concurrent requests'];
    } else if (event.eventType.includes('quota')) {
      rule = 'quota';
      reasonCode = 'quota_exceeded';
      humanSummary = 'Usage quota limit reached.';
      suggestedFix = ['Wait for quota reset', 'Increase quota allocation'];
    } else if (event.eventType.includes('recovery')) {
      rule = 'recovery';
      reasonCode = 'in_recovery';
      humanSummary = 'Session in recovery state.';
      suggestedFix = ['Allow recovery to complete', 'Check session status'];
    }
    
    return {
      decision: event.eventType.includes('deny') || event.eventType.includes('reject') ? 'deny' : 'allow',
      rule,
      reasonCode,
      humanSummary,
      evidence: {
        traceIds: [event.id],
        timestamps: [event.timestamp],
        lastPolicyEvents: [event.eventType],
        ...event.metadata
      },
      suggestedFix
    };
  }
  
  /**
   * Get all trace events for a session
   */
  getSessionTraceEvents(sessionId: AgentSessionId, jobId?: string): TraceEvent[] {
    return this.getSessionEvents(sessionId, jobId);
  }
}