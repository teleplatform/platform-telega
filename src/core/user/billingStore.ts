import { UsageLedger } from '../cost/usageLedger.js';

const billingLedger = new UsageLedger();
let seeded = false;

function seedDemoData() {
  if (seeded) {
    return;
  }

  const now = Date.now();
  const entries = [
    {
      subject: 'demo_user',
      sessionId: 'sid_demo_001',
      kind: 'model' as const,
      units: 1200,
      unitType: 'tokens' as const,
      costMicros: 180000,
      idempotencyKey: 'k2-demo-1',
      metadata: { inputTokens: 900, outputTokens: 300, at: new Date(now - 1200000).toISOString() },
    },
    {
      subject: 'demo_user',
      sessionId: 'sid_demo_001',
      kind: 'tool' as const,
      units: 2,
      unitType: 'calls' as const,
      costMicros: 90000,
      idempotencyKey: 'k2-demo-2',
      metadata: { toolKind: 'net.fetch', at: new Date(now - 1100000).toISOString() },
    },
    {
      subject: 'demo_user',
      sessionId: 'sid_demo_002',
      kind: 'model' as const,
      units: 850,
      unitType: 'tokens' as const,
      costMicros: 130000,
      idempotencyKey: 'k2-demo-3',
      metadata: { inputTokens: 600, outputTokens: 250, at: new Date(now - 420000).toISOString() },
    },
    {
      subject: 'demo_user',
      sessionId: 'sid_demo_002',
      kind: 'compute' as const,
      units: 850,
      unitType: 'milliseconds' as const,
      costMicros: 40000,
      idempotencyKey: 'k2-demo-4',
      metadata: { durationMs: 850, at: new Date(now - 410000).toISOString() },
    },
  ];

  for (const entry of entries) {
    billingLedger.recordEntry(entry);
  }

  seeded = true;
}

seedDemoData();

export { billingLedger };
