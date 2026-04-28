import { NextResponse } from 'next/server';
import { getAuthContext } from '@/app/api/_auth';
import { userBillingService } from '@/core/user/billingSingleton';

type Params = {
  params: Promise<{
    dispute_id: string;
  }>;
};

export async function GET(_request: Request, { params }: Params) {
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

    const { dispute_id: disputeId } = await params;
    if (!disputeId) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'BAD_REQUEST', message: 'dispute_id is required' },
        },
        { status: 400 }
      );
    }

    const detail = userBillingService.getDisputeDetail(auth.userId, disputeId);
    if (!detail) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Dispute not found' },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: detail,
    });
  } catch (error) {
    console.error('Dispute detail API error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch dispute detail' },
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
