import { chromium } from 'playwright';

async function main() {
  console.log('\n🧪 Complete execution with longer wait - Qwen\n==============================================\n');

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
  
  // First, check current state - scroll to bottom
  await qwenPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await qwenPage.waitForTimeout(1000);
  
  // Get current message count
  const initialMsgs = await qwenPage.locator('.user-message, .assistant-message, [class*="message"]').count().catch(() => 0);
  console.log(`Initial messages: ${initialMsgs}`);
  
  // Fill and send
  const textarea = qwenPage.locator('textarea').first();
  await textarea.fill('Reply with just "OK"');
  await textarea.press('Enter');
  console.log('✅ Message sent');
  
  // Wait and poll for new messages
  for (let i = 0; i < 15; i++) {
    await qwenPage.waitForTimeout(2000);
    const currentMsgs = await qwenPage.locator('.user-message, .assistant-message, [class*="message"]').count().catch(() => 0);
    console.log(`   Wait ${(i+1)*2}s - messages: ${currentMsgs}`);
    
    if (currentMsgs > initialMsgs) {
      // New message appeared - get it
      const lastMsg = await qwenPage.locator('.assistant-message, [class*="message"]:last-child').last().textContent().catch(() => '');
      console.log(`\n✅ Response received: ${lastMsg.slice(0, 100)}`);
      break;
    }
    
    if (i === 14) {
      console.log('\n❌ No response after 30 seconds');
    }
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});