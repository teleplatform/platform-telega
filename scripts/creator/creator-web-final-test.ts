import { chromium } from 'playwright';

async function main() {
  console.log('\n🧪 Extract assistant response content - Qwen\n=============================================\n');

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
  
  // Scroll to load all content
  await qwenPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await qwenPage.waitForTimeout(2000);
  
  // Get elements with "assistant" or "response" in class
  const assistantEls = await qwenPage.locator('[class*="assistant"]').all();
  const responseEls = await qwenPage.locator('[class*="response"]').all();
  
  console.log(`Found ${assistantEls.length} [class*="assistant"] elements`);
  console.log(`Found ${responseEls.length} [class*="response"] elements`);
  
  // Get last few from each
  console.log('\n--- Last 3 [class*="assistant"] elements ---');
  const lastAssistants = assistantEls.slice(-3);
  for (const el of lastAssistants) {
    const cls = await el.getAttribute('class').catch(() => '');
    const text = await el.textContent().catch(() => '');
    const tag = await el.evaluate(el => el.tagName);
    console.log(`Tag: ${tag}, Class: ${cls.slice(0, 50)}`);
    console.log(`Text: ${text.slice(0, 150)}...`);
  }
  
  console.log('\n--- Last 3 [class*="response"] elements ---');
  const lastResponses = responseEls.slice(-3);
  for (const el of lastResponses) {
    const cls = await el.getAttribute('class').catch(() => '');
    const text = await el.textContent().catch(() => '');
    const tag = await el.evaluate(el => el.tagName);
    console.log(`Tag: ${tag}, Class: ${cls.slice(0, 50)}`);
    console.log(`Text: ${text.slice(0, 150)}...`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});