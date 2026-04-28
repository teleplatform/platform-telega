import { NextResponse } from 'next/server';
import { getAuthContext } from '@/app/api/_auth';
import { userBillingService } from '@/core/user/billingSingleton';
import type { BillingDisputeStatus } from '@/core/user/billingService';

type Params = {
  params: Promise<{
    dispute_id: string;
  }>;
};

function isValidStatus(status: string): status is BillingDisputeStatus {
  return status === 'open' || status === 'reviewing' || status === 'resolved' || status === 'closed';
}

export async function POST(request: Request, { params }: Params) {
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

    const makerHeader = request.headers.get('x-maker-mode');
    const hasMakerAccess = auth.roles?.includes('maker') || makerHeader === '1';
    if (!hasMakerAccess) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'FORBIDDEN', message: 'Maker role required' },
        },
        { status: 403 }
      );
    }

    const { dispute_id: disputeId } = await params;
    const body = await request.json().catch(() => ({}));
    const statusRaw = typeof body.status === 'string' ? body.status : '';
    const message = typeof body.message === 'string' ? body.message : undefined;
    if (!isValidStatus(statusRaw)) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid status' },
        },
        { status: 400 }
      );
    }

    const updated = userBillingService.simulateDisputeStatus(auth.userId, disputeId, statusRaw, 'maker', message);
    return NextResponse.json({ ok: true, data: updated });
  } catch (error: any) {
    const message = String(error?.message ?? 'unknown');
    if (message.includes('NOT_FOUND')) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Dispute not found' },
        },
        { status: 404 }
      );
    }
    if (message.includes('BAD_REQUEST')) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'BAD_REQUEST', message: message.replace('BAD_REQUEST: ', '') },
        },
        { status: 400 }
      );
    }
    if (message.includes('FORBIDDEN')) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'FORBIDDEN', message: 'Maker role required' },
        },
        { status: 403 }
      );
    }

    console.error('Dispute simulate API error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to simulate dispute status' },
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
