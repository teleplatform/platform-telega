import { bootstrapWebProviderRuntimeState, executeWebOperatorAction } from '../src/providers/web/index.js';

const provider = process.argv[2] as any;

if (!provider || !['openai_web', 'qwen_web', 'deepseek_web'].includes(provider)) {
  console.error('Usage: pnpm creator:web:cooldown:clear <openai_web|qwen_web|deepseek_web>');
  process.exit(1);
}

bootstrapWebProviderRuntimeState();

console.log(`Clearing cooldown for: ${provider}`);
const result = await executeWebOperatorAction({
  action: 'clear_cooldown',
  provider,
  reason: 'manual_clear',
});

if (!result.ok) {
  console.error('Error:', result.error);
  process.exit(1);
}

console.log('\nResult:');
console.log(`  action: ${result.action}`);
console.log(`  provider: ${result.provider}`);
console.log(`  before cooldown: ${result.before?.cooldownUntil ? 'set' : 'none'}`);
console.log(`  after cooldown: ${result.after?.cooldownUntil ? 'set' : 'none'}`);
console.log('\nUpdated mission control snapshot preview:');
console.log(`  selected order: ${result.missionControlSnapshot?.selectedOrder.join(', ')}`);