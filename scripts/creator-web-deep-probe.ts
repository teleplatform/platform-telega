import { chromium } from 'playwright';

async function main() {
  console.log('\n🔍 Deep Probe — What is actually visible?\n========================================\n');

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();

  const openaiPage = pages.find(p => p.url().includes('chatgpt.com') || p.url().includes('chat.openai.com'));
  
  if (!openaiPage) {
    console.log('No OpenAI page found');
    await browser.close();
    process.exit(0);
  }

  console.log(`URL: ${openaiPage.url()}`);
  console.log(`Title: ${await openaiPage.title()}\n`);

  // Check various selectors
  const checks = [
    { name: 'textarea', selector: 'textarea' },
    { name: 'prompt-textarea', selector: '#prompt-textarea' },
    { name: 'contenteditable', selector: '[contenteditable="true"]' },
    { name: 'Log in button', selector: 'button:has-text("Log in")' },
    { name: 'Continue with Google', selector: 'button:has-text("Continue with Google")' },
    { name: 'Sign in text', selector: 'text=Sign in' },
    { name: 'Cloudflare text', selector: 'text=Cloudflare' },
    { name: 'Verify text', selector: 'text=Verify' },
    { name: 'Just a moment', selector: 'text=Just a moment' },
  ];

  for (const check of checks) {
    try {
      const visible = await openaiPage.locator(check.selector).first().isVisible({ timeout: 2000 });
      console.log(`${visible ? '🔴' : '⚪'} ${check.name}: ${visible ? 'VISIBLE' : 'hidden'}`);
    } catch {
      console.log(`⚪ ${check.name}: not found`);
    }
  }

  // Also check viewport
  const viewport = openaiPage.viewportSize();
  console.log(`\nViewport: ${viewport?.width}x${viewport?.height}`);

  await browser.close();
}

main().catch(console.error);