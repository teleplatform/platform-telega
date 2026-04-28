// Ops Signals Engine - Automation & Ops Intelligence v1
// Analyzes metrics and generates actionable operational signals

import { AllMetrics } from '../observability/metricsService.js';

export type SignalSeverity = 'info' | 'warning' | 'critical';
export type SignalCategory = 'capacity' | 'cost' | 'recovery' | 'abuse' | 'misuse';

export type OpsSignal = {
  signalId: string;
  severity: SignalSeverity;
  category: SignalCategory;
  summary: string;
  detectedAt: Date;
  evidence: {
    metrics?: string[];
    sessions?: string[];
    timestamps?: Date[];
    details?: Record<string, any>;
  };
  probableCause: string;
  recommendedActions: string[];
  resolved: boolean;
  resolvedAt?: Date;
  resolverId?: string;
};

export type SessionDetail = {
  sid: string;
  jobId?: string;
  status: string;
  timeline: Array<{
    timestamp: string;
    eventType: string;
    details: string;
  }>;
  explain: any; // DecisionResponse
  receipt: any; // ReceiptResponse
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

export type SignalRule = {
  id: string;
  name: string;
  category: SignalCategory;
  severity: SignalSeverity;
  condition: (current: AllMetrics, previous?: AllMetrics) => boolean;
  summary: (current: AllMetrics, previous?: AllMetrics) => string;
  probableCause: (current: AllMetrics, previous?: AllMetrics) => string;
  recommendedActions: (current: AllMetrics, previous?: AllMetrics) => string[];
};

export class OpsSignalsEngine {
  private rules: SignalRule[] = [];
  private activeSignals: Map<string, OpsSignal> = new Map();
  private previousMetrics: AllMetrics | undefined;
  
  constructor() {
    this.initializeRules();
  }
  
  /**
   * Initialize standard signal rules
   */
  private initializeRules(): void {
    // Capacity rules
    this.rules.push({
      id: 'backpressure_spike',
      name: 'Backpressure Spike',
      category: 'capacity',
      severity: 'critical',
      condition: (current, previous) => {
        const currentRate = current.runtime.deny_rate.backpressure;
        const previousRate = previous?.runtime.deny_rate.backpressure || 0;
        return currentRate > 0 && currentRate > previousRate * 3; // 3x spike
      },
      summary: (current, previous) => {
        const currentRate = current.runtime.deny_rate.backpressure;
        const previousRate = previous?.runtime.deny_rate.backpressure || 0;
        return `Backpressure deny rate spiked from ${previousRate.toFixed(2)}/min to ${currentRate.toFixed(2)}/min`;
      },
      probableCause: (current, previous) => {
        const queueDepth = current.runtime.queue_depth_interactive + current.runtime.queue_depth_batch;
        const maxDepth = 1000; // Assuming max depth of 1000
        return `System overloaded with queue depth at ${queueDepth}/${maxDepth}. May be caused by burst traffic or resource exhaustion.`;
      },
      recommendedActions: (current, previous) => [
        'Check for traffic bursts or scheduled jobs',
        `Scale up workers if queue depth remains high (${current.runtime.queue_depth_interactive + current.runtime.queue_depth_batch}/1000)`,
        'Review recent deployments that might affect performance'
      ]
    });
    
    this.rules.push({
      id: 'queue_imbalance',
      name: 'Queue Imbalance',
      category: 'capacity',
      severity: 'warning',
      condition: (current) => {
        const interactive = current.runtime.queue_depth_interactive;
        const batch = current.runtime.queue_depth_batch;
        return batch > interactive * 5 && interactive > 10; // Batch 5x bigger than interactive, and interactive > 10
      },
      summary: (current) => {
        const interactive = current.runtime.queue_depth_interactive;
        const batch = current.runtime.queue_depth_batch;
        return `Queue imbalance: ${batch} batch vs ${interactive} interactive jobs`;
      },
      probableCause: (current) => {
        return `Batch jobs consuming most resources, starving interactive jobs. Current ratio: ${current.runtime.queue_depth_batch}:${current.runtime.queue_depth_interactive}`;
      },
      recommendedActions: (current) => [
        'Adjust batch job priorities or concurrency limits',
        'Implement separate queue processing schedules',
        'Consider resource partitioning between interactive and batch'
      ]
    });
    
    // Cost rules
    this.rules.push({
      id: 'cost_spike',
      name: 'Cost Spike',
      category: 'cost',
      severity: 'critical',
      condition: (current, previous) => {
        const currentTotal = Object.values(current.billing.cost_micros_total).reduce((a, b) => a + b, 0);
        const previousTotal = previous ? Object.values(previous.billing.cost_micros_total).reduce((a, b) => a + b, 0) : 0;
        return currentTotal > 0 && currentTotal > previousTotal * 3; // 3x spike
      },
      summary: (current, previous) => {
        const currentTotal = Object.values(current.billing.cost_micros_total).reduce((a, b) => a + b, 0);
        const previousTotal = previous ? Object.values(previous.billing.cost_micros_total).reduce((a, b) => a + b, 0) : 0;
        return `Cost spike: ${currentTotal} vs previous ${previousTotal} micros`;
      },
      probableCause: (current) => {
        const costBreakdown = current.billing.cost_micros_total;
        const highestCost = Object.entries(costBreakdown).sort((a, b) => b[1] - a[1])[0];
        return `Highest cost category: ${highestCost[0]} with ${highestCost[1]} micros. Possible inefficient usage pattern.`;
      },
      recommendedActions: (current) => [
        `Review ${Object.entries(current.billing.cost_micros_total).sort((a, b) => b[1] - a[1])[0][0]} usage`,
        'Check for runaway jobs or infinite loops',
        'Verify cost controls and budgets are properly configured'
      ]
    });
    
    this.rules.push({
      id: 'inefficient_jobs',
      name: 'Inefficient Jobs',
      category: 'cost',
      severity: 'warning',
      condition: (current) => {
        // This would be triggered by examining individual job receipts in a real system
        // For now, we'll simulate based on high cost ratios
        const modelCost = current.billing.cost_micros_total.model || 0;
        const toolCost = current.billing.cost_micros_total.tools || 0;
        // High tool-to-model ratio might indicate inefficient usage
        return toolCost > modelCost * 10 && toolCost > 100000; // If tools cost 10x more than model and >0.1 Teletons
      },
      summary: (current) => {
        const modelCost = current.billing.cost_micros_total.model || 0;
        const toolCost = current.billing.cost_micros_total.tools || 0;
        return `Potentially inefficient usage: tools cost (${toolCost}) much higher than model (${modelCost})`;
      },
      probableCause: (current) => {
        return `High tool call costs relative to model costs suggest inefficient usage pattern. May be excessive network calls or file operations.`;
      },
      recommendedActions: (current) => [
        'Review tool usage patterns in job logs',
        'Optimize network calls (batching, caching)',
        'Minimize file system operations'
      ]
    });
    
    // Recovery rules
    this.rules.push({
      id: 'recovery_storm',
      name: 'Recovery Storm',
      category: 'recovery',
      severity: 'critical',
      condition: (current, previous) => {
        const currentRecoverable = current.recovery.recoverable_found;
        const previousRecoverable = previous?.recovery.recoverable_found || 0;
        return currentRecoverable > 5 && currentRecoverable > previousRecoverable * 3; // More than 5 and 3x previous
      },
      summary: (current, previous) => {
        return `Recovery storm: ${current.recovery.recoverable_found} sessions need recovery`;
      },
      probableCause: (current) => {
        return `Multiple sessions failed simultaneously, suggesting system-wide issue. May be infrastructure or code deployment related.`;
      },
      recommendedActions: (current) => [
        'Check system health and infrastructure status',
        'Review recent deployments or configuration changes',
        'Monitor for cascading failures'
      ]
    });
    
    this.rules.push({
      id: 'lease_churn',
      name: 'Lease Churn',
      category: 'recovery',
      severity: 'warning',
      condition: (current) => {
        // Lease churn would be tracked separately in a real system
        // For simulation, we'll use resume fail rate
        const resumeFailRate = current.recovery.resume_fail / (current.recovery.resume_success + current.recovery.resume_fail || 1);
        return resumeFailRate > 0.1; // More than 10% failure rate
      },
      summary: (current) => {
        const failRate = (current.recovery.resume_fail / (current.recovery.resume_success + current.recovery.resume_fail || 1) * 100).toFixed(1);
        return `High lease churn: ${failRate}% resume failures`;
      },
      probableCause: (current) => {
        return `Frequent lease stealing and resume failures suggest instability in worker nodes or network issues.`;
      },
      recommendedActions: (current) => [
        'Check worker node health and connectivity',
        'Review lease timeout configurations',
        'Investigate network partitioning issues'
      ]
    });
    
    // Abuse/Misuse rules
    this.rules.push({
      id: 'denial_flood',
      name: 'Denial Flood',
      category: 'abuse',
      severity: 'critical',
      condition: (current) => {
        // Aggregate all deny rates to detect mass denials
        const totalDenyRate = Object.values(current.runtime.deny_rate).reduce((sum, rate) => sum + rate, 0);
        return totalDenyRate > 50; // More than 50 denials per minute
      },
      summary: (current) => {
        const totalDenyRate = Object.values(current.runtime.deny_rate).reduce((sum, rate) => sum + rate, 0);
        return `Mass denial event: ${totalDenyRate.toFixed(2)} denials per minute`;
      },
      probableCause: (current) => {
        return `High volume of denials suggests either system overload or abusive usage pattern.`;
      },
      recommendedActions: (current) => [
        'Check for traffic anomalies or bot activity',
        'Verify system capacity vs current load',
        'Review rate limiting configurations'
      ]
    });
  }
  
  /**
   * Process new metrics and generate signals
   */
  processMetrics(current: AllMetrics, sessionDetails?: SessionDetail[]): OpsSignal[] {
    const newSignals: OpsSignal[] = [];
    
    // Check each rule
    for (const rule of this.rules) {
      if (rule.condition(current, this.previousMetrics)) {
        // Generate signal ID based on rule and current time
        const signalId = `${rule.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create evidence
        const evidence = this.generateEvidence(rule, current, sessionDetails);
        
        // Create signal
        const signal: OpsSignal = {
          signalId,
          severity: rule.severity,
          category: rule.category,
          summary: rule.summary(current, this.previousMetrics),
          detectedAt: new Date(),
          evidence,
          probableCause: rule.probableCause(current, this.previousMetrics),
          recommendedActions: rule.recommendedActions(current, this.previousMetrics),
          resolved: false
        };
        
        // Store the signal
        this.activeSignals.set(signalId, signal);
        newSignals.push(signal);
      }
    }
    
    // Update previous metrics
    this.previousMetrics = current;
    
    return newSignals;
  }
  
  /**
   * Generate evidence for a signal
   */
  private generateEvidence(rule: SignalRule, current: AllMetrics, sessionDetails?: SessionDetail[]): OpsSignal['evidence'] {
    const evidence: OpsSignal['evidence'] = {
      metrics: [],
      sessions: [],
      timestamps: [new Date()],
      details: {}
    };
    
    // Add relevant metrics based on the rule
    switch (rule.id) {
      case 'backpressure_spike':
        evidence.metrics = [`deny_rate{rule=backpressure}=${current.runtime.deny_rate.backpressure}`];
        evidence.details = {
          queue_depth_interactive: current.runtime.queue_depth_interactive,
          queue_depth_batch: current.runtime.queue_depth_batch,
          active_jobs: current.runtime.jobs_active
        };
        break;
        
      case 'cost_spike':
        evidence.metrics = [`cost_total=${Object.values(current.billing.cost_micros_total).reduce((a, b) => a + b, 0)}`];
        evidence.details = current.billing.cost_micros_total;
        break;
        
      case 'recovery_storm':
        evidence.metrics = [`recoverable_found=${current.recovery.recoverable_found}`];
        evidence.details = {
          resume_success: current.recovery.resume_success,
          resume_fail: current.recovery.resume_fail
        };
        break;
        
      default:
        evidence.details = { ...current };
    }
    
    // Add session information if available
    if (sessionDetails) {
      // For now, just add the session IDs
      evidence.sessions = sessionDetails.map(sd => sd.sid);
    }
    
    return evidence;
  }
  
  /**
   * Get active signals
   */
  getActiveSignals(): OpsSignal[] {
    return Array.from(this.activeSignals.values()).filter(s => !s.resolved);
  }
  
  /**
   * Get signals by category
   */
  getSignalsByCategory(category: SignalCategory): OpsSignal[] {
    return this.getActiveSignals().filter(s => s.category === category);
  }
  
  /**
   * Get signals by severity
   */
  getSignalsBySeverity(severity: SignalSeverity): OpsSignal[] {
    return this.getActiveSignals().filter(s => s.severity === severity);
  }
  
  /**
   * Resolve a signal
   */
  resolveSignal(signalId: string, resolverId: string): boolean {
    const signal = this.activeSignals.get(signalId);
    if (signal) {
      signal.resolved = true;
      signal.resolvedAt = new Date();
      signal.resolverId = resolverId;
      return true;
    }
    return false;
  }
  
  /**
   * Get signal by ID
   */
  getSignalById(signalId: string): OpsSignal | undefined {
    return this.activeSignals.get(signalId);
  }
  
  /**
   * Clear resolved signals older than X minutes
   */
  cleanupResolvedSignals(maxAgeMinutes: number = 60): number {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60000);
    let count = 0;
    
    for (const [id, signal] of this.activeSignals.entries()) {
      if (signal.resolved && signal.resolvedAt && signal.resolvedAt < cutoff) {
        this.activeSignals.delete(id);
        count++;
      }
    }
    
    return count;
  }
}