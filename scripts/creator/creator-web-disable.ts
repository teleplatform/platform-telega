import { bootstrapWebProviderRuntimeState, executeWebOperatorAction } from '../src/providers/web/index.js';

const provider = process.argv[2] as any;

if (!provider || !['openai_web', 'qwen_web', 'deepseek_web'].includes(provider)) {
  console.error('Usage: pnpm creator:web:disable <openai_web|qwen_web|deepseek_web>');
  process.exit(1);
}

bootstrapWebProviderRuntimeState();

console.log(`Disabling provider: ${provider}`);
const result = await executeWebOperatorAction({
  action: 'disable',
  provider,
  reason: 'manual_disable',
});

if (!result.ok) {
  console.error('Error:', result.error);
  process.exit(1);
}

console.log('\nResult:');
console.log(`  action: ${result.action}`);
console.log(`  provider: ${result.provider}`);
console.log(`  before failures: ${result.before?.consecutiveFailures}`);
console.log(`  after failures: ${result.after?.consecutiveFailures}`);
console.log(`  cooldown set: ${result.after?.cooldownUntil ? '24h' : 'none'}`);
console.log('\nUpdated mission control snapshot preview:');
console.log(`  selected order: ${result.missionControlSnapshot?.selectedOrder.join(', ')}`);