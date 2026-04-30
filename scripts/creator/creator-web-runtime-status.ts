import { bootstrapWebProviderRuntimeState } from '../src/providers/web/index.js';
import { getWebRuntimeStatus } from '../src/providers/web/web-provider.status.js';

async function main() {
  bootstrapWebProviderRuntimeState();

  console.log('=== Web Provider Runtime Status ===\n');

  const status = await getWebRuntimeStatus();

  console.log('Provider States:');
  for (const p of status.providers) {
    console.log(`\n[${p.provider}]`);
    console.log(`  score: ${p.score}`);
    console.log(`  ready: ${p.ready}`);
    console.log(`  cooldown: ${p.cooldownRemainingMs ? `${Math.round(p.cooldownRemainingMs / 1000)}s` : 'none'}`);
    console.log(`  rehab: ${p.rehabStage}`);
    console.log(`  streak: ${p.consecutiveSuccesses} success / ${p.consecutiveFailures} fail`);
    console.log(`  last failure: ${p.lastFailureReason || 'none'}`);
    console.log(`  last latency: ${p.lastLatencyMs ? `${p.lastLatencyMs}ms` : 'none'}`);
  }

  console.log('\nSelected Order (by priority):');
  for (let i = 0; i < status.selectedOrder.length; i++) {
    console.log(`  ${i + 1}. ${status.selectedOrder[i]}`);
  }

  console.log(`\nUpdated: ${new Date(status.updatedAt).toISOString()}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});