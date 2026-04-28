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

    return NextResponse.json({
      ok: true,
      data: {
        disputes: userBillingService.listDisputes(auth.userId),
      },
    });
  } catch (error) {
    console.error('Disputes API error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch disputes' },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => ({}));
    const receiptId = typeof body.receipt_id === 'string' ? body.receipt_id.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!receiptId || !reason) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'receipt_id and reason are required',
          },
        },
        { status: 400 }
      );
    }

    const dispute = userBillingService.createDispute(auth.userId, receiptId, reason);
    return NextResponse.json({
      ok: true,
      data: dispute,
    });
  } catch (error) {
    console.error('Dispute API error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create dispute' },
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
