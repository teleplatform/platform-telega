import { chromium } from 'playwright';

async function main() {
  console.log('\n🧪 DeepSeek - Send and wait for response\n=========================================\n');

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();

  const deepseekPage = pages.find(p => p.url().includes('chat.deepseek.com') || p.url().includes('deepseek.com'));
  
  if (!deepseekPage) {
    console.log('❌ DeepSeek tab not found');
    await browser.close();
    process.exit(1);
  }

  await deepseekPage.bringToFront();
  
  const beforeText = await deepseekPage.locator('body').textContent().catch(() => '');
  console.log(`Text length before: ${beforeText.length}`);
  
  // Find textarea - DeepSeek uses different selector
  const textarea = deepseekPage.locator('textarea').first();
  const isVisible = await textarea.isVisible({ timeout: 2000 }).catch(() => false);
  
  if (!isVisible) {
    console.log('❌ Textarea not visible in DeepSeek');
    console.log('Page state:', await deepseekPage.locator('body').textContent().slice(0, 200));
    await browser.close();
    process.exit(1);
  }
  
  await textarea.fill('Reply with exactly: DONE');
  await textarea.press('Enter');
  console.log('✅ Sent');
  
  for (let i = 0; i < 20; i++) {
    await deepseekPage.waitForTimeout(2000);
    
    const currentText = await deepseekPage.locator('body').textContent().catch(() => '');
    const hasDone = currentText.includes('DONE');
    
    console.log(`Wait ${(i+1)*2}s: has "DONE": ${hasDone}`);
    
    if (hasDone) {
      console.log('\n✅ DeepSeek SUCCESS! Response received');
      break;
    }
    
    if (i === 19) {
      console.log('\n❌ DeepSeek: No response after 40 seconds');
    }
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});