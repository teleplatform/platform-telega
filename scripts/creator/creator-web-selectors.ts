import { chromium } from 'playwright';

async function main() {
  console.log('\n🔍 Finding correct selectors for each provider\n==================================================\n');

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();

  for (const [name, patterns] of [
    ['openai', ['chatgpt.com', 'chat.openai.com']],
    ['qwen', ['chat.qwen.ai', 'qwen.ai']],
    ['deepseek', ['chat.deepseek.com', 'deepseek.com']]
  ]) {
    const page = pages.find(p => patterns.some(pat => p.url().includes(pat)));
    if (!page) {
      console.log(`\n${name}: no tab`);
      continue;
    }

    console.log(`\n${name} (${page.url()})`);
    
    // Find buttons
    const buttons = await page.locator('button').all();
    console.log(`   ${buttons.length} buttons found`);
    
    for (const btn of buttons.slice(0, 10)) {
      try {
        const text = await btn.textContent().catch(() => '');
        const visible = await btn.isVisible().catch(() => false);
        const aria = await btn.getAttribute('aria-label').catch(() => '');
        const testid = await btn.getAttribute('data-testid').catch(() => '');
        if (visible && (text || aria || testid)) {
          console.log(`   button: "${text.slice(0,30)}" | aria: ${aria} | testid: ${testid}`);
        }
      } catch {}
    }
    
    // Find form elements
    const forms = await page.locator('form').count();
    console.log(`   ${forms} forms`);
    
    // Check for send-like buttons by text
    const sendBtns = await page.locator('button:has-text("Send"), button:has-text("Submit"), button:has-text("→")').count();
    console.log(`   send-like buttons: ${sendBtns}`);
  }

  await browser.close();
}

main().catch(console.error);