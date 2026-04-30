import { getAuditLogForProvider } from '../src/providers/web/web-provider.audit.js';

const provider = process.argv[2] as any;

if (!provider || !['openai_web', 'qwen_web', 'deepseek_web'].includes(provider)) {
  console.error('Usage: pnpm creator:web:audit:provider <openai_web|qwen_web|deepseek_web>');
  process.exit(1);
}

console.log(`=== Audit Log for ${provider} ===\n`);

const events = getAuditLogForProvider(provider, 50);

if (events.length === 0) {
  console.log('No audit events found for this provider.');
  process.exit(0);
}

for (const event of events) {
  const ts = new Date(event.ts).toISOString();
  console.log(`[${ts}] ${event.action} (${event.source})`);
  if (event.reason) console.log(`    reason: ${event.reason}`);
  if (event.before) console.log(`    before: ${JSON.stringify(event.before).slice(0, 100)}`);
  if (event.after) console.log(`    after: ${JSON.stringify(event.after).slice(0, 100)}`);
  console.log('');
}