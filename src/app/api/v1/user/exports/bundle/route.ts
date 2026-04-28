import { NextResponse } from 'next/server';
import { getAuthContext } from '@/app/api/_auth';
import { userBillingService } from '@/core/user/billingSingleton';

function parseCsv(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const format = (url.searchParams.get('format') || 'json').toLowerCase();
    const receiptIds = parseCsv(url.searchParams.get('receipt_ids'));
    const disputeIds = parseCsv(url.searchParams.get('dispute_ids'));

    const payload = userBillingService.getUnifiedExportBundle(auth.userId, {
      receiptIds,
      disputeIds,
    });

    if (format === 'ndjson') {
      const lines: string[] = [];
      lines.push(
        JSON.stringify({
          type: 'bundle_meta',
          exported_at: payload.exported_at,
          source: payload.source,
          selections: payload.selections,
        })
      );
      for (const file of payload.files) {
        lines.push(JSON.stringify({ type: 'file', ...file }));
      }
      lines.push(JSON.stringify({ type: 'bundle_digest', bundle_digest_sha256: payload.bundle_digest_sha256 }));

      return new Response(lines.join('\n') + '\n', {
        status: 200,
        headers: {
          'content-type': 'application/x-ndjson; charset=utf-8',
          'content-disposition': 'attachment; filename="unified-export-bundle.ndjson"',
        },
      });
    }

    return new Response(JSON.stringify({ ok: true, data: payload }), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': 'attachment; filename="unified-export-bundle.json"',
      },
    });
  } catch (error) {
    console.error('Unified bundle export API error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to export unified bundle' },
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
