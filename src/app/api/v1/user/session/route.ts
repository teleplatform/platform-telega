// User Session Detail API - Layer K1.2
// GET /api/v1/user/session?sid=...
// Provides user-safe session details with explain and receipt

import { NextResponse } from 'next/server';
import { getAuthContext } from '@/app/api/_auth';
import { UserSessionService } from '@/core/user/userSessionService';
import { UsageLedger } from '@/core/cost/usageLedger';
import { ExplainService } from '@/core/observability/explainService';
import { ReceiptService } from '@/core/observability/receiptService';
import { AgentSessionManager } from '@/core/agent/runtime/agentSession';
import { FileOwnershipStorage } from '@/core/agent/runtime/ownershipStorage';
import { JsonlTraceWriter } from '@/core/agent/runtime/traceWriter';

// Global instances - in production, these would be properly managed
const usageLedger = new UsageLedger();
const traceWriter = new JsonlTraceWriter('./evidence'); // Mock path
const sessionManager = new AgentSessionManager(traceWriter);
const ownershipStorage = new FileOwnershipStorage('./evidence');
const explainService = new ExplainService(usageLedger, null as any, null as any); // Mock handlers
const receiptService = new ReceiptService(usageLedger);
const userSessionService = new UserSessionService(
  usageLedger,
  explainService,
  receiptService,
  sessionManager,
  ownershipStorage
);

export async function GET(request: Request) {
  try {
    // Get authenticated user
    const auth = await getAuthContext();
    if (!auth.userId) {
      return NextResponse.json(
        { 
          ok: false, 
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        }, 
        { status: 401 }
      );
    }
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sid');
    
    if (!sessionId) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Missing required parameter: sid'
          }
        },
        { status: 400 }
      );
    }
    
    // Validate session ID format
    if (!sessionId.startsWith('sid_')) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid session ID format'
          }
        },
        { status: 400 }
      );
    }
    
    // Get session detail
    const sessionDetail = await userSessionService.getSessionDetail(sessionId, auth.userId);
    
    return NextResponse.json({
      ok: true,
      data: sessionDetail
    });
    
  } catch (error: any) {
    // Handle specific error cases
    if (error.message.includes('FORBIDDEN')) {
      // Return 404 instead of 403 to avoid information leakage
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found'
          }
        },
        { status: 404 }
      );
    }
    
    if (error.message.includes('NOT_FOUND')) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found'
          }
        },
        { status: 404 }
      );
    }
    
    console.error('Session detail API error:', error);
    
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch session details'
        }
      },
      { status: 500 }
    );
  }
}

// Security and performance configuration
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';