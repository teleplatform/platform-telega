#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Dispute Event Export (K2.5)"
echo "=========================================="

node --import tsx --input-type=module <<'EOF'
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);

const subject = 'demo_user';
const receipt = userBillingService.getReceipts(subject)[0];
if (!receipt) {
  throw new Error('Expected receipt for export flow');
}
const dispute = userBillingService.createDispute(subject, receipt.receipt_id, 'Export smoke');
userBillingService.simulateDisputeStatus(subject, dispute.dispute_id, 'reviewing', 'maker');

const exportedAt = '2026-02-26T00:00:00.000Z';
const a = userBillingService.getDisputeEventExport(subject, dispute.dispute_id, exportedAt);
const b = userBillingService.getDisputeEventExport(subject, dispute.dispute_id, exportedAt);
if (!a || !b) {
  throw new Error('Export payload is missing');
}
if (JSON.stringify(a) !== JSON.stringify(b)) {
  throw new Error('Export is non-deterministic for identical input');
}

const forbidden = userBillingService.getDisputeEventExport('other_user', dispute.dispute_id, exportedAt);
if (forbidden !== null) {
  throw new Error('Ownership isolation failed for export');
}

const serialized = JSON.stringify(a).toLowerCase();
for (const marker of ['ledgerrefs', 'ledger_', 'trace', 'internal', 'subject_id']) {
  if (serialized.includes(marker)) {
    throw new Error(`Unsafe marker leaked in export: ${marker}`);
  }
}

for (let i = 0; i < a.events.length; i += 1) {
  if (a.events[i].seq !== i + 1) {
    throw new Error('Event sequence is not canonical');
  }
  if (i > 0 && a.events[i].at < a.events[i - 1].at) {
    throw new Error('Event timeline is not monotonic');
  }
}

if (typeof a.digest_sha256 !== 'string' || a.digest_sha256.length !== 64) {
  throw new Error('Invalid digest format');
}

console.log('✅ User-safe export payload');
console.log('✅ Ownership isolation for export');
console.log('✅ Deterministic export and digest');
console.log('✅ Canonical event ordering');
EOF

echo "🎉 K2.5 smoke passed"
