import { executeWebProviderWithFallback } from '../src/providers/web/index.js';
import { getWebProviderState, enterRehab, advanceRehab, getRehabStage } from '../src/providers/web/web-provider.state.js';

async function main() {
  console.log('=== Creator Web Rehab Smoke Test ===');
  console.log('');

  const testProvider = 'openai_web';
  
  console.log('Initial state:');
  const initialState = getWebProviderState(testProvider);
  console.log('  rehabStage:', initialState.rehabStage);
  console.log('');

  console.log('Simulating provider entering rehab (coming from cooldown)...');
  enterRehab(testProvider);
  
  const afterEnterState = getWebProviderState(testProvider);
  console.log('  rehabStage:', afterEnterState.rehabStage);
  console.log('  rehabSince:', afterEnterState.rehabSince ? 'set' : 'not set');
  console.log('');

  console.log('Simulating successful response - advancing rehab...');
  advanceRehab(testProvider);
  
  const afterAdvanceState = getWebProviderState(testProvider);
  console.log('  rehabStage:', afterAdvanceState.rehabStage);
  console.log('');

  console.log('Simulating another successful response - final advance...');
  advanceRehab(testProvider);
  
  const finalState = getWebProviderState(testProvider);
  console.log('  rehabStage:', finalState.rehabStage);
  console.log('');

  console.log('Running actual fallback execution...');
  const result = await executeWebProviderWithFallback({
    preferredProvider: testProvider,
    prompt: 'Reply with WEB_REHAB_OK',
    timeoutMs: 30000,
  });

  console.log('');
  console.log('Result:');
  console.log('  ok:', result.ok);
  console.log('  provider:', result.provider);
  console.log('  selectedProvider:', result.selectedProvider);
  console.log('  traceSummary:', result.traceSummary);
  console.log('');

  console.log('Last attempt rehabStage:', result.attempts[result.attempts.length - 1]?.rehabStage);

  console.log('\n✅ Rehab test completed');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});