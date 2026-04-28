import { NextResponse } from 'next/server';
import { getAuthContext } from '@/app/api/_auth';
import { userBillingService } from '@/core/user/billingSingleton';

type Params = {
  params: Promise<{
    receipt_id: string;
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

    const { receipt_id: receiptId } = await params;
    if (!receiptId) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'BAD_REQUEST', message: 'receipt_id is required' },
        },
        { status: 400 }
      );
    }

    const detail = userBillingService.getReceiptDetail(auth.userId, receiptId);
    if (!detail) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Receipt not found' },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: detail,
    });
  } catch (error) {
    console.error('Receipt detail API error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch receipt detail' },
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
