import { chromium } from 'playwright';

async function main() {
  console.log('\n🧪 Simple send test - Enter key\n================================\n');

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();

  const qwenPage = pages.find(p => p.url().includes('chat.qwen.ai') || p.url().includes('qwen.ai'));
  
  if (!qwenPage) {
    console.log('❌ Qwen tab not found');
    process.exit(1);
  }

  await qwenPage.bringToFront();
  await qwenPage.waitForLoadState('domcontentloaded');
  
  console.log(`URL: ${qwenPage.url()}`);
  
  // Try to fill textarea and press Enter
  try {
    const textarea = qwenPage.locator('textarea').first();
    const isVisible = await textarea.isVisible({ timeout: 2000 });
    console.log(`Textarea visible: ${isVisible}`);
    
    if (isVisible) {
      await textarea.fill('Hello - press enter to send');
      console.log('✅ Filled textarea');
      
      // Press Enter to submit
      await textarea.press('Enter');
      console.log('✅ Pressed Enter');
      
      // Wait for response
      await qwenPage.waitForTimeout(5000);
      
      // Check URL after submit
      console.log(`After submit URL: ${qwenPage.url()}`);
      
      // Get page content
      const html = qwenPage.content();
      const hasResponse = html.includes('assistant') || html.includes('response') || html.includes('qwen');
      console.log(`Has response elements: ${hasResponse}`);
    }
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }

  await browser.close();
}

main().catch(console.error);