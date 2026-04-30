import { getAuditLog } from '../src/providers/web/web-provider.audit.js';

const limit = parseInt(process.argv[2] || '20', 10);

console.log(`=== Web Provider Audit Log (last ${limit} events) ===\n`);

const events = getAuditLog(limit);

if (events.length === 0) {
  console.log('No audit events found.');
  process.exit(0);
}

for (const event of events) {
  const ts = new Date(event.ts).toISOString();
  console.log(`[${ts}] ${event.action} ${event.provider} (${event.source})`);
  if (event.reason) console.log(`    reason: ${event.reason}`);
  if (event.operator) console.log(`    operator: ${event.operator}`);
  console.log('');
}