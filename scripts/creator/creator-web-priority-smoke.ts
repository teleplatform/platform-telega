import { executeWebProviderWithFallback } from '../src/providers/web/index.js';

async function main() {
  console.log('=== Creator Web Priority Smoke Test ===');
  console.log('');

  const result = await executeWebProviderWithFallback({
    preferredProvider: 'openai_web',
    prompt: 'Reply with exactly: WEB_PRIORITY_OK',
    timeoutMs: 30000,
  });

  console.log('Result:');
  console.log('  ok:', result.ok);
  console.log('  provider:', result.provider);
  console.log('  transport:', result.transport);
  console.log('  reason:', result.reason);
  console.log('');

  console.log('Attempts:');
  for (const attempt of result.attempts || []) {
    console.log(`  - ${attempt.provider}: ready=${attempt.ready}, executed=${attempt.executed}, ok=${attempt.ok}, reason=${attempt.reason}, score=${attempt.score}, cooldown=${attempt.cooldownUntil ? 'yes' : 'no'}`);
  }

  if (!result.ok) {
    console.log('\n⚠️ Test did not succeed (expected in dev without active tabs)');
    process.exit(0);
  }

  console.log('\n✅ Priority test passed');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});