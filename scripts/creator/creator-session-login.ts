import { chromium } from "playwright";

const provider = process.argv[2] || "openai";

const profiles: Record<string, string> = {
  openai: "/Users/vijaytaitoo/.telegpt/browser-profiles/openai",
  qwen: "/Users/vijaytaitoo/.telegpt/browser-profiles/qwen",
  deepseek: "/Users/vijaytaitoo/.telegpt/browser-profiles/deepseek",
};

const urls: Record<string, string> = {
  openai: "https://chat.openai.com",
  qwen: "https://qianwen.aliyun.com",
  deepseek: "https://chat.deepseek.com",
};

const profileDir = profiles[provider];
const url = urls[provider];

if (!profileDir || !url) {
  console.error(`Invalid provider: ${provider}. Use: openai, qwen, deepseek`);
  process.exit(1);
}

console.log(`\n🔐 Opening ${provider} for manual login...`);
console.log(`   Profile: ${profileDir}`);
console.log(`   URL: ${url}`);
console.log(`\n⚠️  Please login manually, then press Ctrl+C to close.\n`);

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: { width: 1440, height: 900 },
  args: ["--no-sandbox"],
});

const page = context.pages()[0] || (await context.newPage());
await page.goto(url);

await new Promise(() => {});