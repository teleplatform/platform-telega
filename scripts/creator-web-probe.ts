import { chromium, Page, BrowserContext } from 'playwright';

type Provider = 'openai' | 'qwen' | 'deepseek';

function findProviderPage(context: BrowserContext, provider: Provider): Page | undefined {
  const patterns: Record<Provider, string[]> = {
    openai: ['chatgpt.com', 'chat.openai.com'],
    qwen: ['chat.qwen.ai'],
    deepseek: ['chat.deepseek.com'],
  };

  return context.pages().find((page) => {
    const url = page.url();
    return patterns[provider].some((p) => url.includes(p));
  });
}

async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    const locator = page.locator(selector).first();
    return await locator.isVisible({ timeout: 2000 });
  } catch {
    return false;
  }
}

async function probeProvider(page: Page, provider: Provider) {
  const url = page.url();
  const title = await page.title().catch(() => '');

  // Check for Cloudflare challenge FIRST - this blocks everything
  const cloudflareVisible =
    (await isVisible(page, 'text=Cloudflare')) ||
    (await isVisible(page, 'text=Verify you are human')) ||
    (await isVisible(page, 'text=Подтвердите')) ||
    (await isVisible(page, '#challenge-running')) ||
    (await page.evaluate(() => {
      // Check if any overlay covers the viewport
      const overlays = document.querySelectorAll('[style*="position: fixed"], [style*="position:absolute"]');
      for (const el of overlays) {
        const style = window.getComputedStyle(el);
        if (style.display !== 'none' && style.opacity !== '0') {
          const text = el.textContent || '';
          if (text.includes('Cloudflare') || text.includes('Verify') || text.includes('Подтвердите')) {
            return true;
          }
        }
      }
      return false;
    }));

  // Check input (may be visible under challenge)
  const visibleInput =
    (await isVisible(page, 'textarea#prompt-textarea')) ||
    (await isVisible(page, 'textarea')) ||
    (await isVisible(page, '[contenteditable="true"]'));

  // Check actual login buttons (not just text in header)
  const visibleLoginButton =
    (await isVisible(page, 'button:has-text("Log in"):visible')) ||
    (await isVisible(page, 'a[href*="/login"]:visible')) ||
    (await isVisible(page, 'button:has-text("Continue with Google"):visible'));

  const looksLikeChat = url.includes('/c/') || url.includes('/chat');

  // Challenge blocks everything, even if input technically "visible" under it
  const ready = !cloudflareVisible && !visibleLoginButton && looksLikeChat;

  return {
    provider: `${provider}_web`,
    url,
    title,
    input: visibleInput,
    loginButton: visibleLoginButton,
    cloudflare: cloudflareVisible,
    ready,
  };
}

async function main() {
  console.log('\n🔍 CDP Probe — Challenge-Aware\n================================\n');

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];

  if (!context) {
    throw new Error('No browser context found');
  }

  for (const provider of ['openai', 'qwen', 'deepseek'] as const) {
    const page = findProviderPage(context, provider);

    if (!page) {
      console.log(`⚪ ${provider}_web — no tab open`);
      continue;
    }

    const result = await probeProvider(page, provider);
    const icon = result.ready ? '🟢' : result.cloudflare ? '🟡' : result.loginButton ? '🟠' : '🔴';

    console.log(`${icon} ${result.provider}`);
    console.log(`   URL: ${result.url}`);
    console.log(`   Title: ${result.title}`);
    console.log(`   Input: ${result.input ? 'YES' : 'NO'}`);
    console.log(`   Login btn: ${result.loginButton ? 'YES' : 'NO'}`);
    console.log(`   Cloudflare: ${result.cloudflare ? 'YES' : 'NO'}`);
    console.log(`   Ready: ${result.ready ? 'YES' : 'NO'}`);
    console.log('');
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});