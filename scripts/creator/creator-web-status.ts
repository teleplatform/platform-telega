import { chromium } from "playwright";

interface ProviderStatus {
  provider: string;
  url: string;
  hostnames: string[];
}

const PROVIDERS: ProviderStatus[] = [
  { provider: "openai_web", url: "https://chatgpt.com", hostnames: ["chatgpt.com", "chat.openai.com"] },
  { provider: "qwen_web", url: "https://chat.qwen.ai", hostnames: ["chat.qwen.ai", "qwen.ai"] },
  { provider: "deepseek_web", url: "https://chat.deepseek.com", hostnames: ["chat.deepseek.com", "deepseek.com"] },
];

async function main() {
  const CDP_URL = "http://127.0.0.1:9222";

  console.log("\n📊 CDP Session Status Check");
  console.log("============================\n");

  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch (err: any) {
    console.error("❌ Cannot connect to Chrome");
    console.error(`   Error: ${err.message}`);
    console.log("\nStart Chrome with:");
    console.log(`   open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir=~/.telegpt/chrome-profiles/openai-creator`);
    process.exit(1);
  }

  const contexts = browser.contexts();
  if (!contexts.length) {
    console.error("❌ No browser contexts found");
    process.exit(1);
  }

  const context = contexts[0];
  const pages = context.pages();

  for (const prov of PROVIDERS) {
    const page = pages.find(p => prov.hostnames.some(h => p.url().includes(h)));
    
    let url = "not open";
    let status = "🔴 not_open";
    let title = "";
    
    if (page) {
      url = page.url();
      title = await page.title().catch(() => "");
      const html = await page.content().catch(() => "");
      
      const challenge = html.includes("Cloudflare") || html.includes("challenge") || html.includes("Подтвердите");
      const login = html.includes("Log in") || html.includes("Sign in") || html.includes("login") || html.includes("Войти") || url.includes("/sign_in");
      
      if (challenge) {
        status = "🟡 challenge";
      } else if (login) {
        status = "🟠 login_required";
      } else {
        status = "🟢 alive";
      }
    }
    
    console.log(`${status} ${prov.provider}`);
    console.log(`   URL: ${url}`);
    if (title) console.log(`   Title: ${title}`);
    console.log("");
  }

  console.log("Legend:");
  console.log("  🟢 alive      = Session active and authenticated");
  console.log("  🟠 login_required = Login needed");
  console.log("  🟡 challenge  = Cloudflare/challenge detected");
  console.log("  🔴 not_open   = Tab not open in browser\n");

  await browser.close();
}

main().catch((err) => {
  console.error("\n💥 Error:", err.message);
  process.exit(1);
});