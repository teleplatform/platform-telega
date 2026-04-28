// Observability Service - Observability v1
// Main entry point for observability features

import { AgentSessionId } from '../../types/agentRuntime.js';
import { ExplainService, type DecisionResponse } from './explainService.js';
import { ReceiptService, type ReceiptResponse } from './receiptService.js';
import { MetricsService } from './metricsService.js';
import { UsageLedger } from '../cost/usageLedger.js';
import { BackpressureHandler } from '../backpressure/backpressure.js';
import { LeaseManager } from '../recovery/leaseManager.js';

export type ObservabilityServices = {
  explainService: ExplainService;
  receiptService: ReceiptService;
  metricsService: MetricsService;
};

export class ObservabilityService {
  private explainService: ExplainService;
  private receiptService: ReceiptService;
  private metricsService: MetricsService;
  
  constructor(services: ObservabilityServices) {
    this.explainService = services.explainService;
    this.receiptService = services.receiptService;
    this.metricsService = services.metricsService;
  }
  
  /**
   * Get explanation for a decision about a session
   */
  getDecisionExplanation(sessionId: AgentSessionId, jobId?: string): DecisionResponse {
    return this.explainService.getDecisionExplanation(sessionId, jobId);
  }
  
  /**
   * Generate a receipt for a session
   */
  generateReceipt(sessionId: AgentSessionId): ReceiptResponse {
    return this.receiptService.generateReceipt(sessionId);
  }
  
  /**
   * Get all metrics
   */
  getAllMetrics() {
    return this.metricsService.getAllMetrics();
  }
  
  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    return this.metricsService.getPrometheusMetrics();
  }
  
  /**
   * Record a deny event
   */
  recordDeny(rule: Parameters<MetricsService['recordDeny']>[0]): void {
    this.metricsService.recordDeny(rule);
  }
  
  /**
   * Record a latency measurement
   */
  recordLatency(endpoint: Parameters<MetricsService['recordLatency']>[0], ms: number): void {
    this.metricsService.recordLatency(endpoint, ms);
  }
  
  /**
   * Record a ledger write failure
   */
  recordLedgerWriteFailure(): void {
    this.metricsService.recordLedgerWriteFailure();
  }
  
  /**
   * Factory method to create observability service with dependencies
   */
  static create(
    usageLedger: UsageLedger,
    backpressureHandler: BackpressureHandler,
    leaseManager: LeaseManager
  ): ObservabilityService {
    const explainService = new ExplainService(usageLedger, backpressureHandler, leaseManager);
    const receiptService = new ReceiptService(usageLedger);
    const metricsService = new MetricsService(backpressureHandler, leaseManager, usageLedger);
    
    return new ObservabilityService({
      explainService,
      receiptService,
      metricsService
    });
  }
}