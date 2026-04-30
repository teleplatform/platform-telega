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
  process.exit(1);
}

const debugPort = 9222;

console.log(`\n🔗 Creator Session Attach (CDP Mode): ${provider}`);
console.log(`   Profile: ${profileDir}`);
console.log(`   Target: ${url}`);
console.log(`   CDP Port: ${debugPort}`);
console.log(`\nNote: Start Chrome with --remote-debugging-port=9222 first, or use separate launch.\n`);

try {
  const browser = await chromium.connectOverCDP(`http://localhost:${debugPort}`);
  
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    console.log("No Chrome contexts found. Starting Chrome with remote debugging...");
    await browser.close();
    
    const { spawn } = await import("node:child_process");
    const chromePath = process.platform === "darwin" 
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "google-chrome";
    
    const chromeProcess = spawn(chromePath, [
      `--user-data-dir=${profileDir}`,
      `--remote-debugging-port=${debugPort}`,
      "--no-first-run",
      "--no-default-browser-check",
    ], { detached: true, stdio: "ignore" });
    
    chromeProcess.unref();
    
    console.log("Waiting for Chrome to start...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const retryBrowser = await chromium.connectOverCDP(`http://localhost:${debugPort}`);
    const pages = retryBrowser.contexts()[0]?.pages() || [];
    
    if (pages.length > 0) {
      const page = pages[0];
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      console.log(`   Current URL: ${page.url()}`);
    } else {
      console.log("No pages in new context.");
    }
    
    await retryBrowser.close();
  } else {
    const context = contexts[0];
    const pages = context.pages();
    const page = pages[0] || (await context.newPage());
    
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log(`   Current URL: ${page.url()}`);
    
    const title = await page.title();
    console.log(`   Title: ${title}`);
    
    await browser.close();
  }
} catch (error: any) {
  console.error(`\n💥 Error: ${error.message}`);
  console.log("\nTo use CDP mode:");
  console.log("1. Open Chrome manually: google-chrome --user-data-dir=~/.telegpt/chrome-profiles/openai-creator --remote-debugging-port=9222");
  console.log("2. Login to OpenAI if needed");
  console.log("3. Run this script again");
  process.exit(1);
}