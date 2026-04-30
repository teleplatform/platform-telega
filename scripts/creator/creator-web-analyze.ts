import { chromium } from 'playwright';

async function main() {
  console.log('\n🔍 Deep page analysis\n====================\n');

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();

  const checks = [
    ['openai', ['chatgpt.com', 'chat.openai.com']],
    ['qwen', ['chat.qwen.ai', 'qwen.ai']],
    ['deepseek', ['chat.deepseek.com', 'deepseek.com']]
  ];

  for (const [name, patterns] of checks) {
    const page = pages.find(p => patterns.some(pat => p.url().includes(pat)));
    if (!page) {
      console.log(`${name}: ❌ no tab`);
      continue;
    }

    const url = page.url();
    const title = await page.title().catch(() => 'unknown');
    
    // Check visible elements
    const html = await page.content();
    const hasTextarea = html.includes('<textarea');
    const hasInput = html.includes('<input');
    
    // Check for specific content
    const isLoginPage = url.includes('/login') || url.includes('/signin') || url.includes('/sign_in');
    const isCloudflare = html.toLowerCase().includes('cloudflare') || html.toLowerCase().includes('verify you are human');
    
    console.log(`\n${name}:`);
    console.log(`  URL: ${url}`);
    console.log(`  Title: ${title}`);
    console.log(`  textarea in HTML: ${hasTextarea}`);
    console.log(`  input in HTML: ${hasInput}`);
    console.log(`  Login page: ${isLoginPage}`);
    console.log(`  Cloudflare: ${isCloudflare}`);
    
    // Try to find any input field
    try {
      const inputCount = await page.locator('input, textarea, [contenteditable]').count();
      console.log(`  Interactive elements: ${inputCount}`);
    } catch {}
    
    // Try to find submit buttons
    try {
      const btnCount = await page.locator('button').count();
      console.log(`  Button count: ${btnCount}`);
    } catch {}
  }

  await browser.close();
}

main().catch(console.error);