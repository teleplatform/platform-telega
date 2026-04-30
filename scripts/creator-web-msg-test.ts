import { chromium } from 'playwright';

async function main() {
  console.log('\n🧪 Get actual message content - Qwen\n======================================\n');

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
  await qwenPage.waitForLoadState('networkidle');
  
  // Get all message elements
  const messages = await qwenPage.locator('[class*="message"], .assistant, .user').all();
  console.log(`Found ${messages.length} message elements`);
  
  // Get last few messages
  const last5 = messages.slice(-5);
  for (let i = 0; i < last5.length; i++) {
    const msg = last5[i];
    const cls = await msg.getAttribute('class').catch(() => '');
    const text = await msg.textContent().catch(() => '');
    const html = await msg.innerHTML().catch(() => '');
    console.log(`\n--- Message ${i + 1} ---`);
    console.log(`Class: ${cls}`);
    console.log(`Text: ${text.slice(0, 200)}`);
    console.log(`HTML length: ${html.length}`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});