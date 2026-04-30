#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Unified Export Manifest (K2.7)"
echo "============================================="

node --import tsx --input-type=module <<'EOF'
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);

const subject = 'demo_user';
const receipts = userBillingService.getReceipts(subject);
if (!receipts.length) {
  throw new Error('Expected receipts for unified manifest');
}
const dispute = userBillingService.createDispute(subject, receipts[0].receipt_id, 'Manifest smoke');
userBillingService.simulateDisputeStatus(subject, dispute.dispute_id, 'reviewing', 'maker');

const exportedAt = '2026-02-26T00:00:00.000Z';
const a = userBillingService.getUnifiedExportManifest(subject, exportedAt);
const b = userBillingService.getUnifiedExportManifest(subject, exportedAt);
if (JSON.stringify(a) !== JSON.stringify(b)) {
  throw new Error('Unified manifest is non-deterministic');
}

const other = userBillingService.getUnifiedExportManifest('other_user', exportedAt);
if (other.receipts.some((item) => item.receipt_id === receipts[0].receipt_id)) {
  throw new Error('Ownership isolation failed for receipts index');
}
if (other.disputes.some((item) => item.dispute_id === dispute.dispute_id)) {
  throw new Error('Ownership isolation failed for disputes index');
}

const serialized = JSON.stringify(a).toLowerCase();
for (const marker of ['ledgerrefs', 'ledger_', 'trace', 'internal', 'subject_id']) {
  if (serialized.includes(marker)) {
    throw new Error(`Unsafe marker leaked in unified manifest: ${marker}`);
  }
}

for (const item of [...a.receipts, ...a.disputes]) {
  if (typeof item.digest_sha256 !== 'string' || item.digest_sha256.length !== 64) {
    throw new Error('Invalid digest in manifest index');
  }
}
if (typeof a.manifest_digest_sha256 !== 'string' || a.manifest_digest_sha256.length !== 64) {
  throw new Error('Invalid manifest digest');
}

console.log('✅ Unified manifest is deterministic');
console.log('✅ User-safe payload with ownership isolation');
console.log('✅ Receipt/dispute meta-index contains canonical digests');
console.log('✅ Manifest digest is valid');
EOF

echo "🎉 K2.7 smoke passed"
