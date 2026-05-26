import { executeWebProviderBridge } from '../../src/runtime/providers/web/web-provider-bridge';

async function testWebProviderBridge() {
  console.log('Testing TELE•GPT Web Provider Bridge MVP...\n');

  const result = await executeWebProviderBridge({
    providerId: 'openai_web',
    prompt: 'Hello from Tele•GPT Web Provider Bridge MVP test',
  });

  console.log('Result:');
  console.log(JSON.stringify({
    status: 'done',
    provider_id: result.providerId,
    bridge: 'ok',
    response: result.response.content,
    trace_id: result.traceId,
    request_id: result.requestId,
  }, null, 2));

  console.log('\n✅ Web Provider Bridge MVP test passed.');
}

testWebProviderBridge().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
