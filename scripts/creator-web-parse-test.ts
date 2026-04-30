import { chromium } from 'playwright';

async function main() {
  console.log('\n🧪 Find actual Qwen response elements\n======================================\n');

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
  
  // Get page HTML and look for patterns
  const html = await qwenPage.content();
  
  // Look for common patterns
  const patterns = [
    { name: 'markdown-body', regex: /markdown-body/gi },
    { name: 'assistant', regex: /assistant/gi },
    { name: 'response', regex: /response/gi },
    { name: 'content', regex: /class="[^"]*content[^"]*"/gi },
    { name: 'p tag', regex: /<p[^>]*>/gi },
    { name: 'pre tag', regex: /<pre/gi },
  ];
  
  console.log('HTML patterns found:');
  for (const p of patterns) {
    const matches = html.match(p.regex);
    console.log(`  ${p.name}: ${matches ? matches.length : 0}`);
  }
  
  // Try specific selectors
  const selectors = [
    '.markdown-body',
    '.assistant-message', 
    '.response-content',
    '[class*="assistant"]',
    '[class*="response"]',
    'pre code',
    '.prose'
  ];
  
  console.log('\nSelector checks:');
  for (const sel of selectors) {
    const count = await qwenPage.locator(sel).count().catch(() => 0);
    console.log(`  ${sel}: ${count}`);
  }
  
  // Scroll to middle and check
  await qwenPage.evaluate(() => window.scrollTo(0, 500));
  await qwenPage.waitForTimeout(500);
  
  // Get body text
  const bodyText = await qwenPage.locator('body').textContent().catch(() => '');
  console.log(`\nBody text length: ${bodyText.length}`);
  console.log(`Body preview: ${bodyText.slice(0, 300)}...`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});