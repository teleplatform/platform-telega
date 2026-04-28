// Metrics Service - Observability v1
// Provides operational metrics for monitoring and alerting

import { BackpressureHandler } from '../backpressure/backpressure.js';
import { LeaseManager } from '../recovery/leaseManager.js';
import { UsageLedger } from '../cost/usageLedger.js';

export type RuntimeMetrics = {
  jobs_active: number;
  queue_depth_interactive: number;
  queue_depth_batch: number;
  deny_rate: {
    rate_limit: number;
    quota: number;
    backpressure: number;
    budget: number;
    tool_budget: number;
    recovery: number;
  };
  latency_ms_p95: {
    run: number;
    stream: number;
    status: number;
  };
};

export type RecoveryMetrics = {
  recoverable_found: number;
  lease_steals: number;
  resume_success: number;
  resume_fail: number;
};

export type StorageMetrics = {
  gc_deleted: {
    jobs: number;
    traces: number;
    artifacts: number;
  };
  gc_run_duration_ms: number;
};

export type BillingMetrics = {
  cost_micros_total: {
    model: number;
    tools: number;
    storage: number;
    compute: number;
  };
  ledger_write_fail: number;
};

export type AllMetrics = {
  runtime: RuntimeMetrics;
  recovery: RecoveryMetrics;
  storage: StorageMetrics;
  billing: BillingMetrics;
};

export class MetricsService {
  private backpressureHandler: BackpressureHandler;
  private leaseManager: LeaseManager;
  private usageLedger: UsageLedger;
  
  private denyCounts: {
    rate_limit: number;
    quota: number;
    backpressure: number;
    budget: number;
    tool_budget: number;
    recovery: number;
  } = {
    rate_limit: 0,
    quota: 0,
    backpressure: 0,
    budget: 0,
    tool_budget: 0,
    recovery: 0,
  };
  
  private denyTimeWindow: number = 300000; // 5 minutes window for rate calculations
  private denyTimers: Map<string, number[]> = new Map();
  
  private latencyTimers: {
    run: number[];
    stream: number[];
    status: number[];
  } = {
    run: [],
    stream: [],
    status: []
  };
  
  private ledgerWriteFailures: number = 0;
  
  constructor(
    backpressureHandler: BackpressureHandler,
    leaseManager: LeaseManager,
    usageLedger: UsageLedger
  ) {
    this.backpressureHandler = backpressureHandler;
    this.leaseManager = leaseManager;
    this.usageLedger = usageLedger;
    
    // Initialize timers map
    this.denyTimers.set('rate_limit', []);
    this.denyTimers.set('quota', []);
    this.denyTimers.set('backpressure', []);
    this.denyTimers.set('budget', []);
    this.denyTimers.set('tool_budget', []);
    this.denyTimers.set('recovery', []);
  }
  
  /**
   * Record a deny event
   */
  recordDeny(rule: keyof typeof this.denyCounts): void {
    this.denyCounts[rule]++;
    const timers = this.denyTimers.get(rule) || [];
    timers.push(Date.now());
    // Keep only recent events within the time window
    const now = Date.now();
    const recent = timers.filter(time => now - time <= this.denyTimeWindow);
    this.denyTimers.set(rule, recent);
  }
  
  /**
   * Record a latency measurement
   */
  recordLatency(endpoint: 'run' | 'stream' | 'status', ms: number): void {
    const timers = this.latencyTimers[endpoint];
    timers.push(ms);
    
    // Keep only recent measurements (limit to 1000 to prevent memory issues)
    if (timers.length > 1000) {
      this.latencyTimers[endpoint] = timers.slice(-1000);
    }
  }
  
  /**
   * Record a ledger write failure
   */
  recordLedgerWriteFailure(): void {
    this.ledgerWriteFailures++;
  }
  
  /**
   * Get all metrics
   */
  getAllMetrics(): AllMetrics {
    const backpressureStats = this.backpressureHandler.getStats();
    
    // Calculate deny rates (events per minute)
    const denyRates: RuntimeMetrics['deny_rate'] = {
      rate_limit: this.calculateRate('rate_limit'),
      quota: this.calculateRate('quota'),
      backpressure: this.calculateRate('backpressure'),
      budget: this.calculateRate('budget'),
      tool_budget: this.calculateRate('tool_budget'),
      recovery: this.calculateRate('recovery'),
    };
    
    // Calculate p95 latencies
    const latencies: RuntimeMetrics['latency_ms_p95'] = {
      run: this.calculateP95(this.latencyTimers.run),
      stream: this.calculateP95(this.latencyTimers.stream),
      status: this.calculateP95(this.latencyTimers.status),
    };
    
    // Calculate billing metrics
    const allEntries = this.usageLedger.getEntries();
    const billingTotals = allEntries.reduce((acc, entry) => {
      acc[entry.kind] += entry.costMicros;
      return acc;
    }, { model: 0, tools: 0, storage: 0, compute: 0 });
    
    return {
      runtime: {
        jobs_active: backpressureStats.interactive.active + backpressureStats.batch.active,
        queue_depth_interactive: backpressureStats.interactive.pending,
        queue_depth_batch: backpressureStats.batch.pending,
        deny_rate: denyRates,
        latency_ms_p95: latencies,
      },
      recovery: {
        recoverable_found: 0, // Would need to be tracked separately
        lease_steals: 0,      // Would need to be tracked separately
        resume_success: 0,    // Would need to be tracked separately
        resume_fail: 0,       // Would need to be tracked separately
      },
      storage: {
        gc_deleted: {
          jobs: 0,
          traces: 0,
          artifacts: 0,
        },
        gc_run_duration_ms: 0,
      },
      billing: {
        cost_micros_total: billingTotals,
        ledger_write_fail: this.ledgerWriteFailures,
      }
    };
  }
  
  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const metrics = this.getAllMetrics();
    let prometheusOutput = '';
    
    // Runtime metrics
    prometheusOutput += `# Runtime metrics\n`;
    prometheusOutput += `jobs_active ${metrics.runtime.jobs_active}\n`;
    prometheusOutput += `queue_depth_interactive ${metrics.runtime.queue_depth_interactive}\n`;
    prometheusOutput += `queue_depth_batch ${metrics.runtime.queue_depth_batch}\n`;
    
    // Deny rates
    for (const [rule, rate] of Object.entries(metrics.runtime.deny_rate)) {
      prometheusOutput += `deny_rate{rule="${rule}"} ${rate}\n`;
    }
    
    // Latencies
    for (const [endpoint, latency] of Object.entries(metrics.runtime.latency_ms_p95)) {
      prometheusOutput += `latency_ms_p95{endpoint="${endpoint}"} ${latency}\n`;
    }
    
    // Billing metrics
    prometheusOutput += `\n# Billing metrics\n`;
    for (const [kind, total] of Object.entries(metrics.billing.cost_micros_total)) {
      prometheusOutput += `cost_micros_total{kind="${kind}"} ${total}\n`;
    }
    prometheusOutput += `ledger_write_fail ${metrics.billing.ledger_write_fail}\n`;
    
    return prometheusOutput;
  }
  
  private calculateRate(rule: string): number {
    const timers = this.denyTimers.get(rule) || [];
    const now = Date.now();
    const recent = timers.filter(time => now - time <= this.denyTimeWindow);
    // Rate per minute
    return (recent.length / (this.denyTimeWindow / 60000));
  }
  
  private calculateP95(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[Math.min(index, sorted.length - 1)];
  }
  
  /**
   * Reset metrics (for testing)
   */
  reset(): void {
    this.denyCounts = {
      rate_limit: 0,
      quota: 0,
      backpressure: 0,
      budget: 0,
      tool_budget: 0,
      recovery: 0,
    };
    
    this.latencyTimers = {
      run: [],
      stream: [],
      status: []
    };
    
    this.ledgerWriteFailures = 0;
  }
}