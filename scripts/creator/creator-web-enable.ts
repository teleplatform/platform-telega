import { bootstrapWebProviderRuntimeState, executeWebOperatorAction } from '../src/providers/web/index.js';

const provider = process.argv[2] as any;

if (!provider || !['openai_web', 'qwen_web', 'deepseek_web'].includes(provider)) {
  console.error('Usage: pnpm creator:web:enable <openai_web|qwen_web|deepseek_web>');
  process.exit(1);
}

bootstrapWebProviderRuntimeState();

console.log(`Enabling provider: ${provider}`);
const result = await executeWebOperatorAction({
  action: 'enable',
  provider,
  reason: 'manual_enable',
});

if (!result.ok) {
  console.error('Error:', result.error);
  process.exit(1);
}

console.log('\nResult:');
console.log(`  action: ${result.action}`);
console.log(`  provider: ${result.provider}`);
console.log(`  after streak: ${result.after?.consecutiveSuccesses}/${result.after?.consecutiveFailures}`);
console.log(`  rehab: ${result.after?.rehabStage}`);
console.log('\nUpdated mission control snapshot preview:');
console.log(`  selected order: ${result.missionControlSnapshot?.selectedOrder.join(', ')}`);