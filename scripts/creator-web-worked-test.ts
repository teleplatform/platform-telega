import { chromium } from 'playwright';

async function main() {
  console.log('\n🧪 Qwen - Send and wait for streaming\n======================================\n');

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();

  const qwenPage = pages.find(p => p.url().includes('chat.qwen.ai') || p.url().includes('qwen.ai'));
  
  if (!qwenPage) {
    console.log('❌ Qwen tab not found');
    await browser.close();
    process.exit(1);
  }

  await qwenPage.bringToFront();
  
  // Take a snapshot before
  const beforeText = await qwenPage.locator('body').textContent().catch(() => '');
  const beforeLen = beforeText.length;
  console.log(`Text length before: ${beforeLen}`);
  
  // Send message
  const textarea = qwenPage.locator('textarea').first();
  await textarea.fill('Reply with exactly: WORKED');
  await textarea.press('Enter');
  console.log('✅ Sent');
  
  // Wait progressively and check
  for (let i = 0; i < 20; i++) {
    await qwenPage.waitForTimeout(2000);
    
    const currentText = await qwenPage.locator('body').textContent().catch(() => '');
    const currentLen = currentText.length;
    
    // Look for WORKED in the text
    const hasWorked = currentText.includes('WORKED');
    
    console.log(`Wait ${(i+1)*2}s: length=${currentLen}, has "WORKED": ${hasWorked}`);
    
    if (hasWorked) {
      console.log('\n✅ SUCCESS! Response contains "WORKED"');
      console.log(`Full response text found at position: ${currentText.indexOf('WORKED')}`);
      break;
    }
    
    if (i === 19) {
      console.log('\n❌ Response not found after 40 seconds');
      // Show what we have at the end
      console.log(`Final text length: ${currentLen}`);
      console.log(`Last 200 chars: ${currentText.slice(-200)}`);
    }
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});