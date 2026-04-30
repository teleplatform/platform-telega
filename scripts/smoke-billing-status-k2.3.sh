#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Billing Status Mapping (K2.3)"
echo "============================================"

node --import tsx --input-type=module <<'EOF'
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);

const statuses = ['open', 'reviewing', 'resolved', 'closed'];

for (const status of statuses) {
  const a = userBillingService.getDisputeStatusPresentation(status);
  const b = userBillingService.getDisputeStatusPresentation(status);
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`Non-deterministic status mapping for ${status}`);
  }
  if (!a.badge_label || !a.description || !a.next_step.hint) {
    throw new Error(`Incomplete mapping fields for ${status}`);
  }
  if (typeof a.next_step.eta_hours !== 'number' || a.next_step.eta_hours < 0) {
    throw new Error(`Invalid ETA for ${status}`);
  }
}

const subject = 'demo_user';
const receipt = userBillingService.getReceipts(subject)[0];
if (!receipt) {
  throw new Error('Expected receipt for dispute creation');
}
const dispute = userBillingService.createDispute(subject, receipt.receipt_id, 'Status map check');
const detail = userBillingService.getDisputeDetail(subject, dispute.dispute_id);
if (!detail) {
  throw new Error('Expected dispute detail');
}
const presentation = userBillingService.getDisputeStatusPresentation(detail.status);
if (detail.status_view.badge_label !== presentation.badge_label) {
  throw new Error('Detail badge diverges from deterministic mapping');
}
if (detail.next_step.eta_hours !== presentation.next_step.eta_hours) {
  throw new Error('Detail ETA diverges from deterministic mapping');
}

console.log('✅ Deterministic status mapping verified');
console.log('✅ Badge/description/next-step fields are stable');
console.log('✅ Dispute detail uses canonical status presentation');
EOF

echo "🎉 K2.3 smoke passed"
