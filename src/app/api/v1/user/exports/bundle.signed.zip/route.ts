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
    const receiptIds = parseCsv(url.searchParams.get('receipt_ids'));
    const disputeIds = parseCsv(url.searchParams.get('dispute_ids'));
    const exportedAt = url.searchParams.get('exported_at') || undefined;

    const payload = userBillingService.getUnifiedExportSignedZipBundle(auth.userId, {
      receiptIds,
      disputeIds,
      exportedAt,
    });

    return new Response(payload.zip, {
      status: 200,
      headers: {
        'content-type': 'application/zip',
        'content-disposition': 'attachment; filename="unified-export-bundle.signed.zip"',
        'x-bundle-digest-sha256': payload.bundle_digest_sha256,
        'x-signature-key-id': payload.signature.key_id,
        'x-signature-message-v': payload.signature_v3.message_v,
        'x-signature-required-v': 'v3',
        'x-registry-digest-sha256': payload.trust_registry.registry_digest_sha256,
        'x-signature-policy-digest-sha256': payload.trust_policy.policy_digest_sha256,
      },
    });
  } catch (error) {
    console.error('Signed ZIP bundle export API error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to export signed ZIP bundle' },
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
