import { NextResponse } from 'next/server';
import { getAuthContext } from '@/app/api/_auth';
import { userBillingService } from '@/core/user/billingSingleton';

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth.userId) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        },
        { status: 401 }
      );
    }

    const snapshot = userBillingService.getBillingSnapshot(auth.userId);
    const disputes = userBillingService.listDisputes(auth.userId);

    return NextResponse.json({
      ok: true,
      data: {
        ...snapshot,
        disputes,
      },
    });
  } catch (error) {
    console.error('Billing API error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch billing data' },
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
