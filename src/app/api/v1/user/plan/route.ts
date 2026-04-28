import { NextResponse } from 'next/server';
import { getAuthContext } from '@/app/api/_auth';
import { UserPlanService } from '@/core/user/planService';
import { billingLedger } from '@/core/user/billingStore';

const userPlanService = new UserPlanService(billingLedger, 'Asia/Tashkent');

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth.userId) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const plan = userPlanService.getPlan(auth.userId);

    return NextResponse.json({
      ok: true,
      data: plan,
    });
  } catch (error) {
    console.error('Plan API error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch user plan',
        },
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
