// User Dashboard API - Layer K1.1
// GET /api/v1/user/dashboard
// Provides user-facing usage metrics and insights

import { NextResponse } from 'next/server';
import { getAuthContext } from '@/app/api/_auth';
import { UserDashboardService } from '@/core/user/dashboardService';
import { UsageLedger } from '@/core/cost/usageLedger';
import { OpsSignalsEngine } from '@/core/ops-intelligence/opsSignals';

// Global instances - in production, these would be properly managed
const usageLedger = new UsageLedger();
const opsSignalsEngine = new OpsSignalsEngine();
const dashboardService = new UserDashboardService(usageLedger, opsSignalsEngine, 'Asia/Tashkent');

export async function GET() {
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
    
    // Subject ID from auth context (ensures isolation)
    const subjectId = auth.userId;
    
    // Get dashboard data
    const dashboardData = await dashboardService.getDashboard(subjectId);
    
    return NextResponse.json({
      ok: true,
      data: dashboardData
    });
    
  } catch (error) {
    console.error('Dashboard API error:', error);
    
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch dashboard data'
        }
      },
      { status: 500 }
    );
  }
}

// Performance monitoring middleware (would be implemented in production)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';