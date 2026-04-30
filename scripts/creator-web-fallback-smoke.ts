import { executeWebProviderWithFallback, DEFAULT_WEB_CHAIN } from '../src/providers/web/index.js';

async function main() {
  console.log('=== Creator Web Fallback Smoke Test ===');
  console.log('Default chain:', DEFAULT_WEB_CHAIN);
  console.log('');

  const result = await executeWebProviderWithFallback({
    preferredProvider: 'openai_web',
    prompt: 'Reply with exactly: WEB_FALLBACK_OK',
    timeoutMs: 30000,
  });

  console.log('');
  console.log('=== Result ===');
  console.log('ok:', result.ok);
  console.log('provider:', result.provider);
  console.log('transport:', result.transport);
  console.log('reason:', result.reason);
  console.log('attempts count:', result.attempts?.length);
  console.log('');

  console.log('=== Attempts Detail ===');
  for (const attempt of result.attempts || []) {
    console.log({
      provider: attempt.provider,
      ready: attempt.ready,
      executed: attempt.executed,
      ok: attempt.ok,
      reason: attempt.reason,
      transport: attempt.transport,
      responsePreview: attempt.responseText?.slice(0, 50),
    });
  }

  if (!result.ok) {
    console.log('\n⚠️ Fallback test did not succeed (expected in dev env without open tabs)');
    process.exit(0);
  }

  console.log('\n✅ Fallback test passed');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});