// Auto-run test sequence for TeleGPT Extension
// Run in Chrome DevTools Console on chatgpt.com

window.addEventListener('message', e => {
  if (e.data?.source === 'telegpt-content') {
    console.log('FROM EXTENSION:', JSON.stringify(e.data, null, 2));
  }
});

console.log('[TeleGPT] Starting auto-test sequence...');

// PING - Test 1
setTimeout(() => {
  console.log('\n--- PING TEST ---');
  window.postMessage({ source: 'telegpt-page', type: 'TELEGPT_PING' }, '*');
}, 500);

// STATE - Test 2
setTimeout(() => {
  console.log('\n--- STATE TEST ---');
  window.postMessage({ source: 'telegpt-page', type: 'TELEGPT_STATE' }, '*');
}, 1500);

// SEND PROMPT - Test 3
setTimeout(() => {
  console.log('\n--- SEND PROMPT TEST ---');
  window.postMessage({
    source: 'telegpt-page',
    type: 'TELEGPT_SEND_PROMPT',
    text: 'Say EXTENSION_OK'
  }, '*');
}, 3000);

// Summary after all tests
setTimeout(() => {
  console.log('\n[TeleGPT] Tests complete. Check results above.');
  console.log('Expected: PING ok:true, STATE ready:true, SEND ok:true');
}, 10000);