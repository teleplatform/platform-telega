#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Billing UX (K2)"
echo "==============================="

node --import tsx --input-type=module <<'EOF'
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);

const subject = 'demo_user';
const snapshot = userBillingService.getBillingSnapshot(subject);

if (typeof snapshot.balance_teleton_micros !== 'number') {
  throw new Error('Missing read-only balance');
}
if (!Array.isArray(snapshot.transactions)) {
  throw new Error('Transactions list missing');
}
if (!Array.isArray(snapshot.receipts)) {
  throw new Error('Receipts list missing');
}

const serializedReceipts = JSON.stringify(snapshot.receipts);
if (serializedReceipts.includes('ledgerRefs') || serializedReceipts.includes('ledger_')) {
  throw new Error('Receipts leaked internal ledger identifiers');
}

const receiptId = snapshot.receipts[0]?.receipt_id;
if (!receiptId) {
  throw new Error('Expected demo receipt for dispute flow');
}

const dispute = userBillingService.createDispute(subject, receiptId, 'Unexpected model charge');
const disputes = userBillingService.listDisputes(subject);
if (!disputes.some((item) => item.dispute_id === dispute.dispute_id)) {
  throw new Error('Dispute flow entrypoint failed');
}

console.log('✅ Read-only Teleton balance present');
console.log('✅ Transaction history present');
console.log('✅ Receipts are user-safe (no internal IDs)');
console.log('✅ Dispute flow entrypoint works');
EOF

echo "🎉 K2 smoke passed"
