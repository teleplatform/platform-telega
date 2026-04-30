import { chromium } from 'playwright';

async function main() {
  console.log('\n🧪 Send message and extract immediate response - Qwen\n========================================================\n');

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
  
  // Count messages before
  const msgCountBefore = await qwenPage.locator('div').count();
  console.log(`Divs before: ${msgCountBefore}`);
  
  // Send message
  const textarea = qwenPage.locator('textarea').first();
  await textarea.fill('What is 2+2? Reply briefly.');
  await textarea.press('Enter');
  console.log('✅ Sent message');
  
  // Wait for loading
  console.log('⏳ Waiting for response...');
  await qwenPage.waitForTimeout(8000);
  
  // Count messages after
  const msgCountAfter = await qwenPage.locator('div').count();
  console.log(`Divs after: ${msgCountAfter}`);
  
  // Try to find content after our message
  // Get all text content from page
  const bodyHTML = await qwenPage.locator('body').innerHTML();
  console.log(`\nBody HTML length: ${bodyHTML.length}`);
  
  // Look for the response in the text content
  const bodyText = await qwenPage.locator('body').textContent();
  console.log(`Body text length: ${bodyText.length}`);
  
  // Get the last 500 chars to see if there's a response
  const lastText = bodyText.slice(-500);
  console.log(`Last 500 chars:\n${lastText}`);
  
  // Check if we got a response (look for "4" or "four")
  const hasResponse = bodyText.toLowerCase().includes('4') && bodyText.length > msgCountBefore * 10;
  console.log(`\nResponse detected: ${hasResponse}`);

  await browser.close();
  console.log('\n✅ Done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});