import { NextResponse } from 'next/server';
import { getAuthContext } from '@/app/api/_auth';
import { userBillingService } from '@/core/user/billingSingleton';

type Params = {
  params: Promise<{
    dispute_id: string;
  }>;
};

export async function GET(request: Request, { params }: Params) {
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
    const url = new URL(request.url);
    const format = (url.searchParams.get('format') || 'json').toLowerCase();
    const payload = userBillingService.getDisputeEventExport(auth.userId, disputeId);
    if (!payload) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Dispute not found' },
        },
        { status: 404 }
      );
    }

    if (format === 'ndjson') {
      const lines = payload.events.map((event) => JSON.stringify(event)).join('\n');
      return new Response(lines + '\n', {
        status: 200,
        headers: {
          'content-type': 'application/x-ndjson; charset=utf-8',
          'content-disposition': `attachment; filename="${payload.dispute_id}-events.ndjson"`,
        },
      });
    }

    return new Response(JSON.stringify({ ok: true, data: payload }), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${payload.dispute_id}-events.json"`,
      },
    });
  } catch (error) {
    console.error('Dispute export API error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to export dispute events' },
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
