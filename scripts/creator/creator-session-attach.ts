import { chromium } from "playwright";
import os from "node:os";
import path from "node:path";

const HOME = os.homedir();
const BASE_DIR = path.join(HOME, ".telegpt", "chrome-profiles");

const provider = process.argv[2] || "openai";

const profiles: Record<string, string> = {
  openai: path.join(BASE_DIR, "openai-creator"),
  qwen: path.join(BASE_DIR, "qwen-creator"),
  deepseek: path.join(BASE_DIR, "deepseek-creator"),
};

const urls: Record<string, string> = {
  openai: "https://chatgpt.com",
  qwen: "https://qianwen.aliyun.com",
  deepseek: "https://chat.deepseek.com",
};

const profileDir = profiles[provider];
const url = urls[provider];

if (!profileDir || !url) {
  console.error(`Invalid provider: ${provider}`);
  console.log(`Valid: ${Object.keys(profiles).join(", ")}`);
  process.exit(1);
}

console.log(`\n🔗 Creator Session Attach: ${provider}`);
console.log(`   Profile: ${profileDir}`);
console.log(`   URL: ${url}`);
console.log(`\n⚠️  On first run: login manually in the opened window.`);
console.log(`   On subsequent runs: session will be reused automatically.\n`);

try {
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1440, height: 900 },
  });

  const page = context.pages()[0] || (await context.newPage());
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  await page.waitForTimeout(3000);

  const finalUrl = page.url();
  console.log(`   Current URL: ${finalUrl}`);

  if (finalUrl.includes("login") || finalUrl.includes("signin")) {
    console.log("\n📝 No session found in this profile.");
    console.log("   Please login manually now.");
    console.log("   Press Ctrl+C when done - session will be saved.\n");
    await new Promise(() => {});
  } else {
    console.log("\n✅ Session attached successfully!");
    console.log("   Creator Bridge can now use this profile.\n");
  }

  await context.close();
} catch (error: any) {
  console.error(`\n💥 Error: ${error.message}`);
  process.exit(1);
}