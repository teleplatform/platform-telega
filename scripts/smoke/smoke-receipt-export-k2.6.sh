#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Receipt Export (K2.6)"
echo "===================================="

node --import tsx --input-type=module <<'EOF'
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);

const subject = 'demo_user';
const receipt = userBillingService.getReceipts(subject)[0];
if (!receipt) {
  throw new Error('Expected receipt for export');
}

const exportedAt = '2026-02-26T00:00:00.000Z';
const a = userBillingService.getReceiptEventExport(subject, receipt.receipt_id, exportedAt);
const b = userBillingService.getReceiptEventExport(subject, receipt.receipt_id, exportedAt);
if (!a || !b) {
  throw new Error('Receipt export payload missing');
}
if (JSON.stringify(a) !== JSON.stringify(b)) {
  throw new Error('Receipt export is non-deterministic');
}

const forbidden = userBillingService.getReceiptEventExport('other_user', receipt.receipt_id, exportedAt);
if (forbidden !== null) {
  throw new Error('Receipt export ownership isolation failed');
}

const serialized = JSON.stringify(a).toLowerCase();
for (const marker of ['ledgerrefs', 'ledger_', 'trace', 'internal', 'subject_id']) {
  if (serialized.includes(marker)) {
    throw new Error(`Unsafe marker leaked in receipt export: ${marker}`);
  }
}

for (let i = 0; i < a.events.length; i += 1) {
  if (a.events[i].seq !== i + 1) {
    throw new Error('Receipt event sequence is not canonical');
  }
}

if (typeof a.digest_sha256 !== 'string' || a.digest_sha256.length !== 64) {
  throw new Error('Invalid receipt export digest');
}

console.log('✅ Receipt export is user-safe');
console.log('✅ Ownership isolation for receipt export');
console.log('✅ Deterministic payload and digest');
console.log('✅ Canonical sequence present');
EOF

echo "🎉 K2.6 smoke passed"
