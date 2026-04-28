// External Access Service - Enterprise Controls v1
// Read-only access for customers/partners

import { ReceiptResponse } from '../observability/receiptService.js';
import { DecisionResponse } from '../observability/explainService.js';
import { AgentSessionId } from '../../types/agentRuntime.js';
import { RBACService, Subject, Permission } from './rbac.js';

export type CustomerSessionSummary = {
  sid: AgentSessionId;
  status: string;
  costTotal: number; // in micros
  createdAt: Date;
  lastUpdated: Date;
  decisionExplanation?: string; // Brief explanation if denied
};

export type CustomerReceipt = Pick<
  ReceiptResponse, 
  'sessionId' | 'totalCostMicros' | 'breakdown' | 'createdAt'
>;

export type CustomerAccessOptions = {
  allowSessionList: boolean;
  allowReceiptView: boolean;
  allowCostDetails: boolean;
  allowTimelineView: boolean;
  allowDecisionExplanation: boolean;
  maxRetentionDays: number;
  rateLimitRequestsPerMinute: number;
};

export class ExternalAccessService {
  private rbacService: RBACService;
  private accessOptions: Map<string, CustomerAccessOptions> = new Map(); // customer ID to options
  
  constructor(rbacService: RBACService) {
    this.rbacService = rbacService;
  }
  
  /**
   * Configure access options for a customer
   */
  setCustomerAccess(customerId: string, options: Partial<CustomerAccessOptions>): void {
    const defaultOptions: CustomerAccessOptions = {
      allowSessionList: true,
      allowReceiptView: true,
      allowCostDetails: false, // More sensitive
      allowTimelineView: false, // More sensitive
      allowDecisionExplanation: true,
      maxRetentionDays: 90, // 90 days default
      rateLimitRequestsPerMinute: 10 // 10 requests per minute
    };
    
    this.accessOptions.set(customerId, {
      ...defaultOptions,
      ...options
    });
  }
  
  /**
   * Get customer's session list
   */
  async getCustomerSessions(
    customer: Subject
  ): Promise<CustomerSessionSummary[]> {
    // Check if customer has permission to list their own sessions
    if (!this.rbacService.canAccess(customer, 'sessions:list')) {
      throw new Error('Customer does not have permission to view sessions');
    }
    
    const options = this.accessOptions.get(customer.id);
    if (!options || !options.allowSessionList) {
      return []; // No access configured
    }
    
    // In a real system, this would query the session store
    // For now, we'll return mock data
    return [
      {
        sid: 'customer-session-1',
        status: 'completed',
        costTotal: 125000, // 0.125 Teletons
        createdAt: new Date(Date.now() - 86400000), // 1 day ago
        lastUpdated: new Date(Date.now() - 43200000), // 12 hours ago
        decisionExplanation: 'Completed successfully'
      },
      {
        sid: 'customer-session-2',
        status: 'denied',
        costTotal: 0,
        createdAt: new Date(Date.now() - 172800000), // 2 days ago
        lastUpdated: new Date(Date.now() - 172800000), // 2 days ago
        decisionExplanation: 'Budget exceeded: $0.01 cost vs $0.01 limit'
      },
      {
        sid: 'customer-session-3',
        status: 'running',
        costTotal: 50000, // 0.05 Teletons so far
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
        lastUpdated: new Date(Date.now() - 1800000), // 30 mins ago
        decisionExplanation: 'In progress'
      }
    ];
  }
  
  /**
   * Get a specific receipt for customer
   */
  async getCustomerReceipt(
    customer: Subject,
    sessionId: AgentSessionId
  ): Promise<CustomerReceipt | null> {
    // Check if customer has permission to view receipts
    if (!this.rbacService.canAccess(customer, 'receipts:view')) {
      throw new Error('Customer does not have permission to view receipts');
    }
    
    const options = this.accessOptions.get(customer.id);
    if (!options || !options.allowReceiptView) {
      return null; // No access configured
    }
    
    // Verify this receipt belongs to the customer
    const resource = {
      type: 'receipt',
      id: sessionId,
      ownerId: customer.id
    };
    
    if (!this.rbacService.canAccess(customer, 'receipts:view', resource)) {
      throw new Error('Customer does not have permission to view this receipt');
    }
    
    // In a real system, this would fetch from the receipt store
    // For now, we'll return mock data
    return {
      sessionId,
      totalCostMicros: 125000, // 0.125 Teletons
      breakdown: {
        model: {
          tokensIn: 1000,
          tokensOut: 500,
          costMicros: 75000
        },
        tools: {
          count: 5,
          costMicros: 50000,
          details: [
            { kind: 'net.fetch', count: 3, costMicros: 30000 },
            { kind: 'fs.read', count: 2, costMicros: 20000 }
          ]
        },
        storage: {
          bytes: 1048576, // 1MB
          costMicros: 0
        },
        compute: {
          durationMs: 1500,
          costMicros: 0
        }
      },
      createdAt: new Date()
    };
  }
  
  /**
   * Get decision explanation for customer's session
   */
  async getCustomerDecisionExplanation(
    customer: Subject,
    sessionId: AgentSessionId
  ): Promise<DecisionResponse | null> {
    // Check if customer has permission to view decision explanations
    if (!this.rbacService.canAccess(customer, 'sessions:explain')) {
      throw new Error('Customer does not have permission to view decision explanations');
    }
    
    const options = this.accessOptions.get(customer.id);
    if (!options || !options.allowDecisionExplanation) {
      return null; // No access configured
    }
    
    // Verify this session belongs to the customer
    const resource = {
      type: 'session',
      id: sessionId,
      ownerId: customer.id
    };
    
    if (!this.rbacService.canAccess(customer, 'sessions:read', resource)) {
      throw new Error('Customer does not have permission to view this session explanation');
    }
    
    // In a real system, this would fetch from the explanation store
    // For now, we'll return mock data
    return {
      decision: 'allow',
      rule: 'system_normal',
      reasonCode: 'no_issues_found',
      humanSummary: 'Session completed successfully with normal resource usage.',
      evidence: {
        traceIds: ['trace-123'],
        timestamps: [new Date()],
        lastPolicyEvents: ['session_completed_normally']
      },
      suggestedFix: []
    };
  }
  
  /**
   * Check if customer access is rate limited
   */
  async isRateLimited(customerId: string): Promise<boolean> {
    const options = this.accessOptions.get(customerId);
    if (!options) {
      return true; // No access configured
    }
    
    // In a real system, this would track actual API usage
    // For now, we'll return false (not rate limited)
    return false;
  }
  
  /**
   * Get customer's access configuration
   */
  getCustomerAccessConfig(customerId: string): CustomerAccessOptions | null {
    return this.accessOptions.get(customerId) || null;
  }
  
  /**
   * Revoke customer access
   */
  revokeCustomerAccess(customerId: string): void {
    this.accessOptions.delete(customerId);
  }
  
  /**
   * Validate that customer access is within configured limits
   */
  async validateAccess(
    customer: Subject,
    requestedAction: 'session_list' | 'receipt_view' | 'timeline_view' | 'decision_explanation'
  ): Promise<boolean> {
    const options = this.accessOptions.get(customer.id);
    if (!options) {
      return false; // No access configured
    }
    
    switch (requestedAction) {
      case 'session_list':
        return options.allowSessionList;
      case 'receipt_view':
        return options.allowReceiptView;
      case 'timeline_view':
        return options.allowTimelineView;
      case 'decision_explanation':
        return options.allowDecisionExplanation;
      default:
        return false;
    }
  }
}