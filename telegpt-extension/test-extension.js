// Test script to verify extension communication

const TEST_CASES = [
  { provider: 'openai', url: 'https://chatgpt.com' },
  { provider: 'qwen', url: 'https://chat.qwen.ai' },
  { provider: 'deepseek', url: 'https://chat.deepseek.com' }
];

async function testExtension(tabId) {
  console.log('\n🧪 Testing TeleGPT Extension\n============================\n');
  
  // Test 1: Ping
  try {
    const ping = await chrome.runtime.sendMessage({ type: 'PING' });
    console.log(`✅ Extension PING: ${JSON.stringify(ping)}`);
  } catch (e) {
    console.log(`❌ Extension PING failed: ${e.message}`);
    return;
  }
  
  // Test 2: Get Tab URL
  try {
    const tabInfo = await chrome.tabs.sendMessage(tabId, { type: 'GET_STATE' });
    console.log(`✅ Page State: ${JSON.stringify(tabInfo)}`);
  } catch (e) {
    console.log(`❌ Get state failed: ${e.message}`);
  }
  
  // Test 3: Send prompt (only if on a supported page)
  const supported = ['chatgpt.com', 'chat.qwen.ai', 'chat.deepseek.com'];
  const currentTab = await chrome.tabs.get(tabId);
  
  if (currentTab.url && supported.some(s => currentTab.url.includes(s))) {
    console.log(`\n📤 Sending test prompt to ${currentTab.url}...`);
    
    try {
      const sendResult = await chrome.tabs.sendMessage(tabId, { 
        type: 'SEND_PROMPT', 
        text: 'Reply with: EXTENSION_TEST_OK' 
      });
      console.log(`✅ Send result: ${JSON.stringify(sendResult)}`);
      
      // Wait for response
      console.log('⏳ Waiting for response...');
      await new Promise(r => setTimeout(r, 8000));
      
      const stateAfter = await chrome.tabs.sendMessage(tabId, { type: 'GET_STATE' });
      console.log(`📊 State after: ${JSON.stringify(stateAfter)}`);
      
    } catch (e) {
      console.log(`❌ Send failed: ${e.message}`);
    }
  } else {
    console.log(`\n⚪ Not on a supported provider page. Current: ${currentTab.url}`);
    console.log('Navigate to chatgpt.com, chat.qwen.ai, or chat.deepseek.com to test');
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    testExtension(tabs[0].id);
  } else {
    console.log('No active tab found');
  }
});