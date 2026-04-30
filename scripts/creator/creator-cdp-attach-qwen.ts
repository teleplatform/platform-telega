import { chromium } from "playwright";

async function main() {
  const CDP_URL = "http://127.0.0.1:9222";

  console.log("\n🔗 CDP Attach to Chrome: Qwen");
  console.log(`   CDP Endpoint: ${CDP_URL}`);
  console.log("\nPrerequisites:");
  console.log("1. Chrome must be running with --remote-debugging-port=9222");
  console.log("2. You must be logged into Qwen in that Chrome\n");

  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch (err: any) {
    console.error(`❌ Cannot connect to Chrome at ${CDP_URL}`);
    console.error(`   Error: ${err.message}`);
    console.log("\nStart Chrome with:");
    console.log(`   open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir=~/.telegpt/chrome-profiles/openai-creator`);
    process.exit(1);
  }

  const contexts = browser.contexts();
  if (!contexts.length) {
    console.error("❌ No browser contexts found via CDP");
    process.exit(1);
  }

  const context = contexts[0];
  const pages = context.pages();

  let page = pages.find((p) => {
    const url = p.url();
    return url.includes("chat.qwen.ai") || url.includes("qwen.ai");
  });

  if (!page) {
    console.log("No Qwen page found. Opening chat.qwen.ai...");
    page = await context.newPage();
    await page.goto("https://chat.qwen.ai", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
  }

  await page.bringToFront();
  await page.waitForTimeout(3000);

  const url = page.url();
  const title = await page.title().catch(() => "");
  const html = await page.content().catch(() => "");

  console.log(`   Current URL: ${url}`);
  console.log(`   Title: ${title}`);

  const blocked =
    html.includes("Подтвердите, что вы человек") ||
    html.includes("Verify you are human") ||
    html.includes("Cloudflare") ||
    html.includes("Just a moment") ||
    html.includes("challenge");

  const loginRequired =
    html.includes("Continue with Google") ||
    html.includes("Log in") ||
    html.includes("Sign in") ||
    html.includes("登录") ||
    html.includes("登录") ||
    url.includes("/login") ||
    url.includes("/signin");

  if (blocked) {
    console.error("\n❌ Cloudflare/challenge detected in Chrome session");
    console.error("   The session needs re-authentication.");
    await browser.close();
    process.exit(1);
  }

  if (loginRequired) {
    console.error("\n❌ Qwen login required in Chrome session");
    console.error("   Please login manually in the Chrome window first.");
    await browser.close();
    process.exit(1);
  }

  console.log("\n✅ Successfully attached to live Chrome session");
  console.log(`   Provider: qwen_web`);
  console.log(`   Session: authenticated\n`);

  await browser.close();
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err.message);
  process.exit(1);
});