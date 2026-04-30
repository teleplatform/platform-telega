import { bootstrapWebProviderRuntimeState, executeWebOperatorAction } from '../src/providers/web/index.js';

const provider = process.argv[2] as any;
const stage = process.argv[3] as any;

if (!provider || !['openai_web', 'qwen_web', 'deepseek_web'].includes(provider)) {
  console.error('Usage: pnpm creator:web:rehab:set <openai_web|qwen_web|deepseek_web> <probation|recovery|restored>');
  process.exit(1);
}

if (!stage || !['probation', 'recovery', 'restored'].includes(stage)) {
  console.error('Usage: pnpm creator:web:rehab:set <openai_web|qwen_web|deepseek_web> <probation|recovery|restored>');
  process.exit(1);
}

bootstrapWebProviderRuntimeState();

console.log(`Setting rehab stage for ${provider} to ${stage}`);
const result = await executeWebOperatorAction({
  action: 'rehab_set',
  provider,
  reason: `manual_set_to_${stage}`,
  rehabStage: stage,
});

if (!result.ok) {
  console.error('Error:', result.error);
  process.exit(1);
}

console.log('\nResult:');
console.log(`  action: ${result.action}`);
console.log(`  provider: ${result.provider}`);
console.log(`  before rehab: ${result.before?.rehabStage}`);
console.log(`  after rehab: ${result.after?.rehabStage}`);
console.log('\nUpdated mission control snapshot preview:');
console.log(`  selected order: ${result.missionControlSnapshot?.selectedOrder.join(', ')}`);