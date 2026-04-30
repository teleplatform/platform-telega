import { 
  setWebProviderState, 
  markWebProviderFailure, 
  snapshotWebProviderState,
  resetWebProviderState,
  getWebProviderState 
} from '../src/providers/web/web-provider.state.js';
import { loadPersistedWebProviderState, clearPersistedWebProviderState } from '../src/providers/web/web-provider.persistence.js';

async function main() {
  console.log('=== Creator Web Persistence Smoke Test ===');
  console.log('');

  const testProvider = 'openai_web';

  console.log('1. Setting up provider state with failure + cooldown...');
  markWebProviderFailure(testProvider, 'cloudflare_challenge', 5 * 60 * 1000);
  
  let currentState = getWebProviderState(testProvider);
  console.log('   Current state:');
  console.log('     consecutiveFailures:', currentState.consecutiveFailures);
  console.log('     lastFailureReason:', currentState.lastFailureReason);
  console.log('     cooldownUntil:', currentState.cooldownUntil ? 'set' : 'none');
  console.log('');

  console.log('2. Verifying persistence file exists...');
  const persisted = loadPersistedWebProviderState();
  if (!persisted) {
    console.error('   ERROR: No persisted state found');
    process.exit(1);
  }
  console.log('   Persisted state found:', persisted.providers[testProvider] ? 'yes' : 'no');
  console.log('');

  console.log('3. Simulating process restart - clearing in-memory store...');
  resetWebProviderState(testProvider);
  
  let clearedState = getWebProviderState(testProvider);
  console.log('   After reset:');
  console.log('     consecutiveFailures:', clearedState.consecutiveFailures);
  console.log('     rehabStage:', clearedState.rehabStage);
  console.log('');

  console.log('4. Re-hydrating from persisted state...');
  const { hydrateWebProviderState } = await import('../src/providers/web/web-provider.state.js');
  hydrateWebProviderState();
  
  let hydratedState = getWebProviderState(testProvider);
  console.log('   After hydration:');
  console.log('     consecutiveFailures:', hydratedState.consecutiveFailures);
  console.log('     lastFailureReason:', hydratedState.lastFailureReason);
  console.log('     cooldownUntil:', hydratedState.cooldownUntil ? 'set' : 'none');
  console.log('     rehabStage:', hydratedState.rehabStage);
  console.log('');

  if (hydratedState.consecutiveFailures !== 1) {
    console.error('❌ FAIL: consecutiveFailures not restored');
    process.exit(1);
  }
  if (hydratedState.lastFailureReason !== 'cloudflare_challenge') {
    console.error('❌ FAIL: lastFailureReason not restored');
    process.exit(1);
  }
  if (!hydratedState.cooldownUntil) {
    console.error('❌ FAIL: cooldownUntil not restored');
    process.exit(1);
  }

  console.log('5. Cleaning up test data...');
  clearPersistedWebProviderState();
  console.log('   Cleared');
  console.log('');

  console.log('✅ Persistence test passed');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});