// Dispute/Chargeback Flow - Enterprise Controls v1
// Process for challenging billing decisions with evidence

import { ReceiptResponse } from '../observability/receiptService.js';
import { DecisionResponse } from '../observability/explainService.js';
import { AgentSessionId } from '../../types/agentRuntime.js';
import { RBACService, Subject, Permission } from './rbac.js';

export type DisputeStatus = 
  | 'open'           // Dispute submitted, awaiting review
  | 'under_review'   // Being investigated
  | 'resolved'       // Investigation complete
  | 'closed'         // Final decision made
  | 'chargeback';    // Funds returned to customer

export type DisputeCategory = 
  | 'billing_error'      // Incorrect charges
  | 'service_issue'      // Service didn't work as expected
  | 'authorization'      // Unauthorized usage
  | 'system_error'       // Platform error led to charges
  | 'other';             // Other reason

export type Dispute = {
  id: string;
  sessionId: AgentSessionId;
  receiptId?: string;
  customerId: string;
  submittedAt: Date;
  category: DisputeCategory;
  description: string;
  status: DisputeStatus;
  evidence: Array<{
    id: string;
    type: 'receipt' | 'trace' | 'log' | 'screenshot' | 'other';
    content: string;
    uploadedAt: Date;
  }>;
  reviewerId?: string;
  reviewedAt?: Date;
  resolutionNotes?: string;
  chargebackAmount?: number; // Amount to refund in micros
  resolvedAt?: Date;
};

export type DisputeCreationRequest = {
  sessionId: AgentSessionId;
  category: DisputeCategory;
  description: string;
  receipt?: ReceiptResponse;
  evidenceUrls?: string[];
};

export type DisputeResolution = {
  disputeId: string;
  resolution: DisputeStatus;
  notes: string;
  chargebackAmount?: number; // Amount to refund in micros
};

export class DisputeService {
  private rbacService: RBACService;
  private disputes: Map<string, Dispute> = new Map();
  
  constructor(rbacService: RBACService) {
    this.rbacService = rbacService;
  }
  
  /**
   * Submit a new dispute
   */
  async submitDispute(
    customer: Subject,
    request: DisputeCreationRequest
  ): Promise<Dispute> {
    // Verify customer has rights to dispute this session
    const resource = {
      type: 'session',
      id: request.sessionId,
      ownerId: customer.id
    };
    
    if (!this.rbacService.canAccess(customer, 'receipts:view', resource) &&
        !this.rbacService.canAccess(customer, 'sessions:read', resource)) {
      throw new Error('Customer does not have permission to dispute this session');
    }
    
    // Create dispute ID
    const disputeId = `dispute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Prepare evidence
    const evidence = [];
    
    // Add receipt as evidence if provided
    if (request.receipt) {
      evidence.push({
        id: `evidence_receipt_${disputeId}`,
        type: 'receipt' as const,
        content: JSON.stringify(request.receipt),
        uploadedAt: new Date()
      });
    }
    
    // Add any additional evidence
    if (request.evidenceUrls) {
      for (const url of request.evidenceUrls) {
        evidence.push({
          id: `evidence_url_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'screenshot' as const,
          content: url,
          uploadedAt: new Date()
        });
      }
    }
    
    const dispute: Dispute = {
      id: disputeId,
      sessionId: request.sessionId,
      customerId: customer.id,
      submittedAt: new Date(),
      category: request.category,
      description: request.description,
      status: 'open',
      evidence,
      reviewerId: undefined,
      reviewedAt: undefined,
      resolutionNotes: undefined,
      chargebackAmount: undefined,
      resolvedAt: undefined
    };
    
    this.disputes.set(disputeId, dispute);
    
    return dispute;
  }
  
  /**
   * Get a dispute by ID
   */
  async getDispute(
    user: Subject,
    disputeId: string
  ): Promise<Dispute | null> {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) {
      return null;
    }
    
    // Check if user has permission to view this dispute
    const hasPermission = this.rbacService.canAccess(user, 'audit:read') ||
                         dispute.customerId === user.id;
    
    if (!hasPermission) {
      throw new Error('User does not have permission to view this dispute');
    }
    
    return dispute;
  }
  
  /**
   * List disputes for a customer or all disputes for auditors
   */
  async listDisputes(
    user: Subject,
    filters?: {
      status?: DisputeStatus;
      category?: DisputeCategory;
      dateRange?: { from: Date; to: Date };
    }
  ): Promise<Dispute[]> {
    // Check permissions
    if (!this.rbacService.canAccess(user, 'audit:read') && 
        !this.rbacService.canAccess(user, 'receipts:view')) {
      throw new Error('User does not have permission to list disputes');
    }
    
    let disputes = Array.from(this.disputes.values());
    
    // Filter for customer if not auditor/admin
    if (!this.rbacService.canAccess(user, 'audit:read')) {
      disputes = disputes.filter(d => d.customerId === user.id);
    }
    
    // Apply filters
    if (filters) {
      if (filters.status) {
        disputes = disputes.filter(d => d.status === filters.status);
      }
      if (filters.category) {
        disputes = disputes.filter(d => d.category === filters.category);
      }
      if (filters.dateRange) {
        disputes = disputes.filter(d => 
          d.submittedAt >= filters.dateRange!.from && 
          d.submittedAt <= filters.dateRange!.to
        );
      }
    }
    
    return disputes;
  }
  
  /**
   * Review and resolve a dispute
   */
  async resolveDispute(
    reviewer: Subject,
    resolution: DisputeResolution
  ): Promise<Dispute> {
    // Check if reviewer has permission to resolve disputes
    if (!this.rbacService.canAccess(reviewer, 'audit:read')) {
      throw new Error('User does not have permission to resolve disputes');
    }
    
    const dispute = this.disputes.get(resolution.disputeId);
    if (!dispute) {
      throw new Error('Dispute not found');
    }
    
    // Update dispute status
    dispute.status = resolution.resolution;
    dispute.resolutionNotes = resolution.notes;
    dispute.chargebackAmount = resolution.chargebackAmount;
    dispute.reviewerId = reviewer.id;
    dispute.reviewedAt = new Date();
    dispute.resolvedAt = new Date();
    
    // If chargeback, validate amount doesn't exceed original cost
    if (resolution.resolution === 'chargeback' && resolution.chargebackAmount) {
      // In a real system, this would verify the chargeback amount against the original receipt
      // For now, we'll accept any amount as valid
    }
    
    this.disputes.set(resolution.disputeId, dispute);
    
    return dispute;
  }
  
  /**
   * Get dispute statistics
   */
  async getDisputeStats(
    user: Subject
  ): Promise<{
    total: number;
    byStatus: Record<DisputeStatus, number>;
    byCategory: Record<DisputeCategory, number>;
    averageResolutionTime: number; // in days
  }> {
    // Check permissions
    if (!this.rbacService.canAccess(user, 'audit:read')) {
      throw new Error('User does not have permission to view dispute statistics');
    }
    
    const disputes = Array.from(this.disputes.values());
    
    const stats = {
      total: disputes.length,
      byStatus: {
        open: 0,
        'under_review': 0,
        resolved: 0,
        closed: 0,
        chargeback: 0
      } as Record<DisputeStatus, number>,
      byCategory: {
        billing_error: 0,
        service_issue: 0,
        authorization: 0,
        system_error: 0,
        other: 0
      } as Record<DisputeCategory, number>,
      averageResolutionTime: 0 // calculated below
    };
    
    // Count by status and category
    for (const dispute of disputes) {
      stats.byStatus[dispute.status]++;
      stats.byCategory[dispute.category]++;
    }
    
    // Calculate average resolution time for resolved disputes
    const resolvedDisputes = disputes.filter(d => d.resolvedAt);
    if (resolvedDisputes.length > 0) {
      const totalTime = resolvedDisputes.reduce((sum, dispute) => {
        if (dispute.submittedAt && dispute.resolvedAt) {
          return sum + (dispute.resolvedAt.getTime() - dispute.submittedAt.getTime());
        }
        return sum;
      }, 0);
      
      stats.averageResolutionTime = (totalTime / resolvedDisputes.length) / (1000 * 60 * 60 * 24); // convert to days
    }
    
    return stats;
  }
  
  /**
   * Add evidence to an existing dispute
   */
  async addEvidence(
    user: Subject,
    disputeId: string,
    evidence: {
      type: 'receipt' | 'trace' | 'log' | 'screenshot' | 'other';
      content: string;
    }
  ): Promise<Dispute> {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) {
      throw new Error('Dispute not found');
    }
    
    // Check if user has permission to add evidence to this dispute
    const hasPermission = this.rbacService.canAccess(user, 'audit:read') ||
                         dispute.customerId === user.id;
    
    if (!hasPermission) {
      throw new Error('User does not have permission to add evidence to this dispute');
    }
    
    // Add evidence
    dispute.evidence.push({
      id: `evidence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: evidence.type,
      content: evidence.content,
      uploadedAt: new Date()
    });
    
    this.disputes.set(disputeId, dispute);
    
    return dispute;
  }
}