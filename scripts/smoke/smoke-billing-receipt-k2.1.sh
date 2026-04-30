#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Billing Receipt Detail (K2.1)"
echo "============================================="

node --import tsx --input-type=module <<'EOF'
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);

const subject = 'demo_user';
const receipts = userBillingService.getReceipts(subject);
if (!receipts.length) {
  throw new Error('Expected at least one receipt');
}

const receiptId = receipts[0].receipt_id;
const detail = userBillingService.getReceiptDetail(subject, receiptId);
if (!detail) {
  throw new Error('Receipt detail not found for owned receipt');
}

const serialized = JSON.stringify(detail);
if (serialized.includes('ledgerRefs') || serialized.includes('"id":"ledger_')) {
  throw new Error('Internal identifiers leaked in receipt detail');
}

if (!detail.integrity.sum_matches_total) {
  throw new Error('Receipt integrity mismatch');
}

const forbidden = userBillingService.getReceiptDetail('other_user', receiptId);
if (forbidden !== null) {
  throw new Error('Subject isolation failed for receipt detail');
}

console.log('✅ Receipt detail resolves by receipt_id');
console.log('✅ Subject isolation enforced');
console.log('✅ User-safe payload (no internal IDs)');
console.log('✅ Integrity flag present and valid');
EOF

echo "🎉 K2.1 smoke passed"
