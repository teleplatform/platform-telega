import { chromium } from 'playwright';

async function main() {
  console.log('\n🧪 Full execution test - Qwen\n================================\n');

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
  await qwenPage.waitForLoadState('domcontentloaded');
  
  const startUrl = qwenPage.url();
  console.log(`Start URL: ${startUrl}`);
  
  try {
    // Fill textarea
    const textarea = qwenPage.locator('textarea').first();
    const isVisible = await textarea.isVisible({ timeout: 2000 });
    console.log(`Textarea visible: ${isVisible}`);
    
    if (isVisible) {
      await textarea.fill('Say "OK" if you receive this message');
      console.log('✅ Filled message');
      
      // Press Enter to send
      await textarea.press('Enter');
      console.log('✅ Sent message');
      
      // Wait for response (longer wait)
      console.log('⏳ Waiting for response...');
      await qwenPage.waitForTimeout(10000);
      
      const endUrl = qwenPage.url();
      console.log(`End URL: ${endUrl}`);
      
      // Try to get response text
      try {
        // Look for any text that might be a response
        const body = await qwenPage.locator('body').textContent();
        const responsePreview = body ? body.slice(0, 500) : 'no content';
        console.log(`Page content preview: ${responsePreview}`);
        
        if (endUrl !== startUrl) {
          console.log('\n✅ EXECUTION SUCCESS - URL changed (message sent)');
          console.log(`   Chat URL: ${endUrl}`);
        } else {
          console.log('\n⚠️ URL did not change - response may be pending');
        }
      } catch (e: any) {
        console.log(`Error getting content: ${e.message}`);
      }
    } else {
      console.log('❌ Textarea not visible');
    }
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }

  await browser.close();
  console.log('\n✅ Test complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});