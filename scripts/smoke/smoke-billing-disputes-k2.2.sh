#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Billing Disputes (K2.2)"
echo "======================================"

node --import tsx --input-type=module <<'EOF'
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);

const subject = 'demo_user';
const receipt = userBillingService.getReceipts(subject)[0];
if (!receipt) {
  throw new Error('Expected at least one receipt for dispute creation');
}

const created = userBillingService.createDispute(subject, receipt.receipt_id, 'Unexpected tool charge');

// K2.2-Smoke-1: ownership
const forbidden = userBillingService.getDisputeDetail('other_user', created.dispute_id);
if (forbidden !== null) {
  throw new Error('Ownership violation: foreign subject accessed dispute detail');
}

// K2.2-Smoke-2: contract safety
const detail = userBillingService.getDisputeDetail(subject, created.dispute_id);
if (!detail) {
  throw new Error('Dispute detail should exist for owner');
}
const serialized = JSON.stringify(detail).toLowerCase();
const blockedMarkers = ['ledgerrefs', 'ledger_', 'trace', 'internal'];
if (blockedMarkers.some((marker) => serialized.includes(marker))) {
  throw new Error('Unsafe contract: internal markers leaked in dispute detail');
}

// K2.2-Smoke-3: deterministic UX fields
const validStatuses = new Set(['open', 'reviewing', 'resolved', 'closed']);
if (!validStatuses.has(detail.status)) {
  throw new Error(`Unexpected dispute status: ${detail.status}`);
}
let prev = '';
for (const item of detail.timeline) {
  if (!validStatuses.has(item.status)) {
    throw new Error(`Unexpected timeline status: ${item.status}`);
  }
  if (prev && item.at < prev) {
    throw new Error('Timeline is not monotonic');
  }
  if (typeof item.message !== 'string' || !item.message.trim()) {
    throw new Error('Timeline message must be non-empty');
  }
  prev = item.at;
}

console.log('✅ Ownership isolation enforced');
console.log('✅ Contract is user-safe');
console.log('✅ Status/timeline UX fields are deterministic');
EOF

echo "🎉 K2.2 smoke passed"
