#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Unified Export Bundle (K2.8)"
echo "==========================================="

node --import tsx --input-type=module <<'EOF'
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);

const subject = 'demo_user';
const receipts = userBillingService.getReceipts(subject);
if (!receipts.length) {
  throw new Error('Expected receipts for bundle');
}
const dispute = userBillingService.createDispute(subject, receipts[0].receipt_id, 'Bundle smoke');
userBillingService.simulateDisputeStatus(subject, dispute.dispute_id, 'reviewing', 'maker');

const exportedAt = '2026-02-26T00:00:00.000Z';
const receiptIds = receipts.slice(0, 1).map((item) => item.receipt_id);
const disputeIds = [dispute.dispute_id];
const a = userBillingService.getUnifiedExportBundle(subject, { receiptIds, disputeIds, exportedAt });
const b = userBillingService.getUnifiedExportBundle(subject, { receiptIds, disputeIds, exportedAt });
if (JSON.stringify(a) !== JSON.stringify(b)) {
  throw new Error('Bundle export is non-deterministic');
}

if (!a.files.length || a.files[0].path !== 'disputes/' + dispute.dispute_id + '.json' && !a.files.some((f) => f.path === 'manifest.json')) {
  throw new Error('Deterministic layout is invalid');
}

const paths = a.files.map((file) => file.path);
const sorted = [...paths].sort((x, y) => x.localeCompare(y));
if (JSON.stringify(paths) !== JSON.stringify(sorted)) {
  throw new Error('Bundle files are not sorted deterministically');
}

for (const file of a.files) {
  const expected = createHash('sha256').update(file.content).digest('hex');
  if (file.digest_sha256 !== expected) {
    throw new Error(`Per-file digest mismatch for ${file.path}`);
  }
  if (file.size_bytes !== Buffer.byteLength(file.content, 'utf8')) {
    throw new Error(`Per-file size mismatch for ${file.path}`);
  }
}

const bundleCanonical = JSON.stringify(
  a.files.map((file) => ({
    path: file.path,
    digest_sha256: file.digest_sha256,
    size_bytes: file.size_bytes,
  }))
);
const expectedBundleDigest = createHash('sha256').update(bundleCanonical).digest('hex');
if (a.bundle_digest_sha256 !== expectedBundleDigest) {
  throw new Error('Bundle digest mismatch');
}

const other = userBillingService.getUnifiedExportBundle('other_user', { receiptIds, disputeIds, exportedAt });
if (other.files.some((file) => file.path.includes(receipts[0].receipt_id) || file.path.includes(dispute.dispute_id))) {
  throw new Error('Ownership isolation failed for bundle export');
}

const serialized = JSON.stringify(a).toLowerCase();
for (const marker of ['ledgerrefs', 'ledger_', 'trace', 'internal', 'subject_id']) {
  if (serialized.includes(marker)) {
    throw new Error(`Unsafe marker leaked in bundle export: ${marker}`);
  }
}

console.log('✅ Deterministic bundle layout and ordering');
console.log('✅ Per-file digest and size integrity');
console.log('✅ Bundle digest integrity');
console.log('✅ Ownership isolation and user-safe payload');
EOF

echo "🎉 K2.8 smoke passed"
