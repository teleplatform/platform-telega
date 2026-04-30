#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: Dispute Simulator (K2.4)"
echo "======================================="

node --import tsx --input-type=module <<'EOF'
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { userBillingService } = await import(pathToFileURL(`${root}/src/core/user/billingSingleton.ts`).href);

const subject = 'demo_user';
const receipt = userBillingService.getReceipts(subject)[0];
if (!receipt) {
  throw new Error('Expected receipt for dispute simulator');
}

const created = userBillingService.createDispute(subject, receipt.receipt_id, 'K2.4 simulator check');
const base = userBillingService.getDisputeDetail(subject, created.dispute_id);
if (!base) {
  throw new Error('Missing created dispute');
}
const baseTimeline = JSON.parse(JSON.stringify(base.timeline));

// Maker-only guard
let forbiddenOk = false;
try {
  userBillingService.simulateDisputeStatus(subject, created.dispute_id, 'reviewing', 'public');
} catch (error) {
  forbiddenOk = String(error).includes('FORBIDDEN');
}
if (!forbiddenOk) {
  throw new Error('Maker-only guard failed');
}

const reviewing = userBillingService.simulateDisputeStatus(subject, created.dispute_id, 'reviewing', 'maker');
if (reviewing.status !== 'reviewing') {
  throw new Error('Transition open -> reviewing failed');
}
if (reviewing.timeline.length !== baseTimeline.length + 1) {
  throw new Error('Timeline append length invalid after reviewing transition');
}
for (let i = 0; i < baseTimeline.length; i += 1) {
  const a = JSON.stringify(baseTimeline[i]);
  const b = JSON.stringify(reviewing.timeline[i]);
  if (a !== b) {
    throw new Error('Timeline append rule violated: previous entries mutated');
  }
}
for (let i = 1; i < reviewing.timeline.length; i += 1) {
  if (reviewing.timeline[i].at < reviewing.timeline[i - 1].at) {
    throw new Error('Timeline monotonic rule violated');
  }
}

const resolved = userBillingService.simulateDisputeStatus(subject, created.dispute_id, 'resolved', 'maker');
if (resolved.status !== 'resolved' || resolved.resolution === null) {
  throw new Error('Transition reviewing -> resolved failed');
}
const closed = userBillingService.simulateDisputeStatus(subject, created.dispute_id, 'closed', 'maker');
if (closed.status !== 'closed' || closed.resolution === null) {
  throw new Error('Transition resolved -> closed failed');
}

let invalidTransitionOk = false;
try {
  userBillingService.simulateDisputeStatus(subject, created.dispute_id, 'open', 'maker');
} catch (error) {
  invalidTransitionOk = String(error).includes('BAD_REQUEST');
}
if (!invalidTransitionOk) {
  throw new Error('Invalid transition guard failed');
}

console.log('✅ Maker-only simulator guard works');
console.log('✅ Strict timeline append rules enforced');
console.log('✅ Canonical transition chain works');
console.log('✅ Invalid transition rejected');
EOF

echo "🎉 K2.4 smoke passed"
