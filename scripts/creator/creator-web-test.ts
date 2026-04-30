import { chromium, Page, BrowserContext } from 'playwright';

type Provider = 'openai' | 'qwen' | 'deepseek';

function findProviderPage(context: BrowserContext, provider: Provider): Page | undefined {
  const patterns: Record<Provider, string[]> = {
    openai: ['chatgpt.com', 'chat.openai.com'],
    qwen: ['chat.qwen.ai', 'qwen.ai'],
    deepseek: ['chat.deepseek.com', 'deepseek.com'],
  };

  return context.pages().find((page) => {
    const url = page.url();
    return patterns[provider].some((p) => url.includes(p));
  });
}

async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    return await page.locator(selector).first().isVisible({ timeout: 2000 });
  } catch {
    return false;
  }
}

async function checkReady(page: Page) {
  const cloudflareVisible =
    (await isVisible(page, 'text=Cloudflare')) ||
    (await isVisible(page, 'text=Verify you are human')) ||
    (await isVisible(page, 'text=Подтвердите'));

  const loginButtonVisible =
    (await isVisible(page, 'button:has-text("Log in"):visible')) ||
    (await isVisible(page, 'a[href*="/login"]:visible'));

  const inputVisible = await isVisible(page, 'textarea');

  return { ready: !cloudflareVisible && !loginButtonVisible && inputVisible, cloudflare: cloudflareVisible, loginButton: loginButtonVisible, input: inputVisible };
}

async function testExecution(page: Page, provider: string): Promise<{ success: boolean; response: string; error?: string }> {
  const beforeText = await page.locator('body').textContent().catch(() => '');
  const beforeLen = beforeText.length;
  
  const textarea = page.locator('textarea').first();
  const testPrompt = provider === 'qwen' ? 'Reply with: QWEN_OK' : 'Reply with: DEEPSEEK_OK';
  
  await textarea.fill(testPrompt);
  await textarea.press('Enter');
  
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(2000);
    
    const currentText = await page.locator('body').textContent().catch(() => '');
    const hasResponse = provider === 'qwen' ? currentText.includes('QWEN_OK') : currentText.includes('DEEPSEEK_OK');
    
    if (hasResponse) {
      return { success: true, response: currentText.includes('QWEN_OK') ? 'QWEN_OK' : 'DEEPSEEK_OK' };
    }
    
    if (i === 19) {
      return { success: false, response: '', error: 'timeout' };
    }
  }
  
  return { success: false, response: '', error: 'unknown' };
}

async function main() {
  console.log('\n🧪 CDP Execution Test — All Providers\n=========================================\n');

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];

  const results: { provider: string; status: string; details: string }[] = [];

  for (const provider of ['openai', 'qwen', 'deepseek'] as const) {
    const page = findProviderPage(context, provider);
    const providerName = `${provider}_web`;

    if (!page) {
      results.push({ provider: providerName, status: '⚪ SKIP', details: 'no tab' });
      continue;
    }

    const check = await checkReady(page);

    if (!check.ready) {
      const reason = check.cloudflare ? 'cloudflare' : check.loginButton ? 'login' : 'no_input';
      results.push({ provider: providerName, status: '🟡 BLOCKED', details: reason });
      continue;
    }

    await page.bringToFront();
    console.log(`\n${providerName}: Testing...`);
    
    const exec = await testExecution(page, provider);
    
    if (exec.success) {
      results.push({ provider: providerName, status: '🟢 PASS', details: exec.response });
    } else {
      results.push({ provider: providerName, status: '🔴 FAIL', details: exec.error || 'failed' });
    }
  }

  console.log('\n========================================');
  console.log('RESULTS');
  console.log('========================================\n');
  
  for (const r of results) {
    console.log(`${r.status} ${r.provider}: ${r.details}`);
  }

  const passed = results.filter(r => r.status.includes('PASS')).length;
  console.log(`\nPassed: ${passed}/${results.filter(r => !r.status.includes('SKIP')).length}`);

  await browser.close();
  process.exit(passed > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});