// Audit Export Service - Enterprise Controls v1
// Secure export of audit data and receipts for compliance

import { ReceiptResponse } from '../observability/receiptService.js';
import { DecisionResponse } from '../observability/explainService.js';
import { AgentSessionId } from '../../types/agentRuntime.js';
import { RBACService, Subject, Permission } from './rbac.js';

export type AuditFormat = 'json' | 'csv' | 'pdf';

export type AuditExportOptions = {
  format: AuditFormat;
  includeReceipts?: boolean;
  includeExplanations?: boolean;
  includeTimeline?: boolean;
  includeCostDetails?: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
  resourceIds?: string[]; // Specific sessions, receipts, etc.
};

export type AuditExportResult = {
  id: string;
  filename: string;
  mimeType: string;
  size: number; // in bytes
  createdAt: Date;
  createdBy: string;
  format: AuditFormat;
  content: Buffer | string;
  signature?: string; // Digital signature for authenticity
  integrityHash?: string; // Hash for integrity verification
};

export class AuditExportService {
  private rbacService: RBACService;
  
  constructor(rbacService: RBACService) {
    this.rbacService = rbacService;
  }
  
  /**
   * Export audit data based on user permissions and requested options
   */
  async exportAuditData(
    user: Subject,
    options: AuditExportOptions
  ): Promise<AuditExportResult | null> {
    // Check if user has audit export permission
    if (!this.rbacService.canAccess(user, 'audit:export')) {
      throw new Error('User does not have permission to export audit data');
    }
    
    // Generate export ID
    const exportId = `audit_export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Fetch the requested data based on options
    let exportContent: string;
    
    switch (options.format) {
      case 'json':
        exportContent = await this.generateJsonExport(options, user);
        break;
      case 'csv':
        exportContent = await this.generateCsvExport(options, user);
        break;
      case 'pdf':
        exportContent = await this.generatePdfExport(options, user);
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
    
    // Create digital signature for authenticity
    const signature = await this.createDigitalSignature(exportContent, user);
    
    // Calculate integrity hash
    const integrityHash = await this.calculateIntegrityHash(exportContent);
    
    // Determine mime type
    const mimeTypes: Record<AuditFormat, string> = {
      json: 'application/json',
      csv: 'text/csv',
      pdf: 'application/pdf'
    };
    
    const result: AuditExportResult = {
      id: exportId,
      filename: this.generateFilename(options),
      mimeType: mimeTypes[options.format],
      size: new Blob([exportContent]).size,
      createdAt: new Date(),
      createdBy: user.id,
      format: options.format,
      content: exportContent,
      signature,
      integrityHash
    };
    
    return result;
  }
  
  /**
   * Export receipt data specifically
   */
  async exportReceipt(
    user: Subject,
    receipt: ReceiptResponse,
    format: AuditFormat = 'json'
  ): Promise<AuditExportResult | null> {
    // Check if user has permission to view this receipt
    const resource = {
      type: 'receipt',
      id: receipt.sessionId,
      ownerId: user.id // Simplified for demo
    };
    
    if (!this.rbacService.canAccess(user, 'receipts:export', resource) &&
        !this.rbacService.canAccess(user, 'receipts:view', resource)) {
      throw new Error('User does not have permission to export this receipt');
    }
    
    const exportId = `receipt_export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let exportContent: string;
    switch (format) {
      case 'json':
        exportContent = JSON.stringify(receipt, null, 2);
        break;
      case 'csv':
        exportContent = this.receiptToCsv(receipt);
        break;
      case 'pdf':
        exportContent = await this.receiptToPdf(receipt);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
    
    const signature = await this.createDigitalSignature(exportContent, user);
    const integrityHash = await this.calculateIntegrityHash(exportContent);
    
    const mimeTypes: Record<AuditFormat, string> = {
      json: 'application/json',
      csv: 'text/csv',
      pdf: 'application/pdf'
    };
    
    const result: AuditExportResult = {
      id: exportId,
      filename: `receipt_${receipt.sessionId}.${format}`,
      mimeType: mimeTypes[format],
      size: new Blob([exportContent]).size,
      createdAt: new Date(),
      createdBy: user.id,
      format,
      content: exportContent,
      signature,
      integrityHash
    };
    
    return result;
  }
  
  private generateFilename(options: AuditExportOptions): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const prefix = options.resourceIds ? `audit_${options.resourceIds.join('_')}` : 'audit_export';
    return `${prefix}_${timestamp}.${options.format}`;
  }
  
  private async generateJsonExport(options: AuditExportOptions, user: Subject): Promise<string> {
    // In a real system, this would query databases for audit logs
    // For now, we'll create a mock export structure
    
    const exportData = {
      exportId: `export_${Date.now()}`,
      exportedAt: new Date().toISOString(),
      exportedBy: user.id,
      options,
      data: {
        receipts: options.includeReceipts ? [] : undefined,
        explanations: options.includeExplanations ? [] : undefined,
        timeline: options.includeTimeline ? [] : undefined,
        costDetails: options.includeCostDetails ? [] : undefined
      }
    };
    
    return JSON.stringify(exportData, null, 2);
  }
  
  private async generateCsvExport(options: AuditExportOptions, user: Subject): Promise<string> {
    // Create CSV header
    let csv = 'timestamp,session_id,event_type,description,cost_usd\n';
    
    // In a real system, this would fetch actual audit log data
    // For now, we'll create mock data
    csv += `"${new Date().toISOString()}","session-123","model_call","GPT-4 usage",0.05\n`;
    csv += `"${new Date().toISOString()}","session-123","tool_call","net.fetch operation",0.01\n`;
    csv += `"${new Date().toISOString()}","session-123","cost_total","Session completed",0.06\n`;
    
    return csv;
  }
  
  private async generatePdfExport(options: AuditExportOptions, user: Subject): Promise<string> {
    // In a real system, this would generate an actual PDF
    // For now, we'll return a placeholder
    return `<html>
      <head><title>Audit Export</title></head>
      <body>
        <h1>Audit Export Report</h1>
        <p>Exported by: ${user.id}</p>
        <p>Date: ${new Date().toISOString()}</p>
        <p>Options: ${JSON.stringify(options)}</p>
        <p>This is a placeholder for the actual PDF content.</p>
      </body>
    </html>`;
  }
  
  private receiptToCsv(receipt: ReceiptResponse): string {
    let csv = 'item_type,description,quantity,cost_micros,total_cost\n';
    
    // Model costs
    csv += `model,"${receipt.breakdown.model.tokensIn} input + ${receipt.breakdown.model.tokensOut} output tokens",1,${receipt.breakdown.model.costMicros},${receipt.totalCostMicros}\n`;
    
    // Tool costs
    csv += `tools,"${receipt.breakdown.tools.count} tool calls",${receipt.breakdown.tools.count},${receipt.breakdown.tools.costMicros},${receipt.totalCostMicros}\n`;
    
    // Add other cost categories
    csv += `storage,"${receipt.breakdown.storage.bytes} bytes",1,${receipt.breakdown.storage.costMicros},${receipt.totalCostMicros}\n`;
    
    return csv;
  }
  
  private async receiptToPdf(receipt: ReceiptResponse): Promise<string> {
    return `<html>
      <head><title>Receipt Export</title></head>
      <body>
        <h1>Cost Receipt</h1>
        <p>Session ID: ${receipt.sessionId}</p>
        <p>Total Cost: ${(receipt.totalCostMicros / 1000000).toFixed(6)} Teletons</p>
        <table border="1" style="border-collapse: collapse;">
          <thead>
            <tr>
              <th>Type</th>
              <th>Description</th>
              <th>Cost (Teletons)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Model</td>
              <td>${receipt.breakdown.model.tokensIn} in + ${receipt.breakdown.model.tokensOut} out tokens</td>
              <td>${(receipt.breakdown.model.costMicros / 1000000).toFixed(6)}</td>
            </tr>
            <tr>
              <td>Tools</td>
              <td>${receipt.breakdown.tools.count} tool calls</td>
              <td>${(receipt.breakdown.tools.costMicros / 1000000).toFixed(6)}</td>
            </tr>
            <tr>
              <td>Storage</td>
              <td>${receipt.breakdown.storage.bytes} bytes</td>
              <td>${(receipt.breakdown.storage.costMicros / 1000000).toFixed(6)}</td>
            </tr>
          </tbody>
        </table>
        <p>Exported at: ${receipt.createdAt.toISOString()}</p>
      </body>
    </html>`;
  }
  
  private async createDigitalSignature(content: string, user: Subject): Promise<string> {
    // In a real system, this would create an actual digital signature
    // For now, we'll create a simple hash-based signature
    const str = `${content}:${user.id}:${Date.now()}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  private async calculateIntegrityHash(content: string): Promise<string> {
    // In a real system, this would calculate a proper cryptographic hash
    // For now, we'll create a simple hash
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}