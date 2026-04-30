#!/usr/bin/env node
import { headfulLoginAndSave } from "../src/web-bridge/browserd.ts";
import { getAdapter } from "../src/web-bridge/adapterRegistry.ts";

type WebProvider = "chatgpt_web" | "qwen_web" | "deepseek_web";

function parseProvider(s: string): WebProvider {
  const p = String(s || "").trim() as WebProvider;
  if (p !== "chatgpt_web" && p !== "qwen_web" && p !== "deepseek_web") {
    throw new Error(`bad provider: ${s}. Use chatgpt_web|qwen_web|deepseek_web`);
  }
  return p;
}

async function main() {
  const [, , cmd, providerArg] = process.argv;

  if (!cmd || !providerArg) {
    console.log("Usage:");
    console.log("  tele-gpt web:login <provider>");
    console.log("  tele-gpt web:health <provider>");
    console.log("Providers: chatgpt_web | qwen_web | deepseek_web");
    process.exit(1);
  }

  const provider = parseProvider(providerArg);

  if (cmd === "web:login") {
    const r = await headfulLoginAndSave(provider);
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  if (cmd === "web:health") {
    const adapter = getAdapter(provider);
    if (!adapter) {
      console.log(JSON.stringify({ ok: false, reason: "no_adapter" }, null, 2));
      process.exit(2);
    }
    const r = await adapter.selfTest();
    console.log(JSON.stringify(r, null, 2));
    if (!r.ok) process.exit(3);
    return;
  }

  console.log(`Unknown command: ${cmd}`);
  process.exit(1);
}

main().catch((e) => {
  console.error("[tele-gpt] error:", e?.message || e);
  process.exit(1);
});
