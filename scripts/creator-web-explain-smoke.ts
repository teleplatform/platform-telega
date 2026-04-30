import { executeWebProviderWithFallback } from '../src/providers/web/index.js';

async function main() {
  console.log('=== Creator Web Explain Smoke Test ===');
  console.log('');

  const result = await executeWebProviderWithFallback({
    preferredProvider: 'openai_web',
    prompt: 'Reply with WEB_EXPLAIN_OK',
    timeoutMs: 30000,
  });

  console.log('Result:');
  console.log('  ok:', result.ok);
  console.log('  provider:', result.provider);
  console.log('  selectedProvider:', result.selectedProvider);
  console.log('  traceSummary:', result.traceSummary);
  console.log('');

  console.log('Attempts:');
  for (const attempt of result.attempts || []) {
    console.log(`  - ${attempt.provider}:`);
    console.log(`      ready=${attempt.ready}, executed=${attempt.executed}, ok=${attempt.ok}`);
    console.log(`      score=${attempt.score}, reason=${attempt.reason}`);
    console.log(`      explain=${attempt.explain?.join(', ')}`);
    console.log(`      retryPlanned=${attempt.retryPlanned}`);
  }

  if (!result.traceSummary?.length) {
    console.error('\n❌ traceSummary missing');
    process.exit(1);
  }

  console.log('\n✅ Explain test passed');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});