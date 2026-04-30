#!/bin/bash
set -euo pipefail

echo "🧪 Smoke Test: User Plan (K1.3)"
echo "================================"

node --import tsx --input-type=module <<'EOF'
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { UsageLedger } = await import(pathToFileURL(`${root}/src/core/cost/usageLedger.ts`).href);
const { UserPlanService } = await import(pathToFileURL(`${root}/src/core/user/planService.ts`).href);

const ledger = new UsageLedger();
const planService = new UserPlanService(ledger, 'Asia/Tashkent');

const now = new Date();
const isoNow = now.toISOString();

ledger.recordEntry({
  subject: 'user-alpha',
  sessionId: 'sid_alpha_1',
  kind: 'model',
  units: 100,
  unitType: 'tokens',
  costMicros: 700000,
  idempotencyKey: 'alpha-1',
  metadata: { at: isoNow }
});

ledger.recordEntry({
  subject: 'user-beta',
  sessionId: 'sid_beta_1',
  kind: 'tool',
  units: 1,
  unitType: 'calls',
  costMicros: 250000,
  idempotencyKey: 'beta-1',
  metadata: { at: isoNow }
});

const planA1 = planService.getPlan('user-alpha', now);
const planA2 = planService.getPlan('user-alpha', now);
const planB = planService.getPlan('user-beta', now);
const planEnterprise = planService.getPlan('enterprise-user-1', now);

if (JSON.stringify(planA1) !== JSON.stringify(planA2)) {
  throw new Error('Contract drift: same input produced different output');
}

if (planA1.usage.today.used_micros !== 700000) {
  throw new Error(`Subject isolation failed for user-alpha, got ${planA1.usage.today.used_micros}`);
}

if (planB.usage.today.used_micros !== 250000) {
  throw new Error(`Subject isolation failed for user-beta, got ${planB.usage.today.used_micros}`);
}

if (planEnterprise.usage.today.limit_micros !== null) {
  throw new Error('limit_micros must remain null for unlimited plan');
}

if (planA1.usage.today.remaining_micros === null || planA1.usage.today.remaining_micros < 0) {
  throw new Error('remaining_micros must be non-negative for limited plan');
}

if (planA1.usage.today.forecast_end_micros < planA1.usage.today.used_micros) {
  throw new Error('forecast must not be less than used');
}

if (planA1.source.ledger !== 'usage-ledger-v1') {
  throw new Error('ledger source marker mismatch');
}

console.log('✅ GET /api/v1/user/plan contract surface stable');
console.log('✅ Subject isolation confirmed');
console.log('✅ null limit semantics preserved');
console.log('✅ Non-negative remaining confirmed');
console.log('✅ Deterministic calendar forecast confirmed');
console.log('✅ Contract drift check passed');
EOF

echo "🎉 K1.3 smoke passed"
