import { NextResponse } from 'next/server';
import { getAuthContext } from '@/app/api/_auth';
import { userBillingService } from '@/core/user/billingSingleton';

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
    const payload = userBillingService.getUnifiedExportManifest(auth.userId);

    if (format === 'ndjson') {
      const lines: string[] = [];
      lines.push(JSON.stringify({ type: 'manifest_meta', exported_at: payload.exported_at, source: payload.source }));
      for (const receipt of payload.receipts) {
        lines.push(JSON.stringify({ type: 'receipt', ...receipt }));
      }
      for (const dispute of payload.disputes) {
        lines.push(JSON.stringify({ type: 'dispute', ...dispute }));
      }
      lines.push(JSON.stringify({ type: 'manifest_digest', manifest_digest_sha256: payload.manifest_digest_sha256 }));

      return new Response(lines.join('\n') + '\n', {
        status: 200,
        headers: {
          'content-type': 'application/x-ndjson; charset=utf-8',
          'content-disposition': 'attachment; filename="unified-export-manifest.ndjson"',
        },
      });
    }

    return new Response(JSON.stringify({ ok: true, data: payload }), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': 'attachment; filename="unified-export-manifest.json"',
      },
    });
  } catch (error) {
    console.error('Unified manifest export API error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to export unified manifest' },
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
