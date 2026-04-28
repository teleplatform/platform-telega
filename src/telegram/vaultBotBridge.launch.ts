/**
 * Launch entry point for LaunchAgent
 *
 * This file is used by the macOS LaunchAgent to start the vault bot bridge.
 * It's a thin wrapper that loads env vars and launches the bot.
 */

import { launchVaultBot } from "./vaultBotBridge.js";

// Load environment from .env if dotenv is available
try {
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env" });
} catch {
  // dotenv not available, use process.env only
}

console.log("[vault-bridge-launch] Starting Tele GPT Vault Bridge...");
console.log(`[vault-bridge-launch] Tele GPT URL: ${process.env.VAULT_BOT_TELEGPT_URL ?? "http://localhost:8787"}`);
console.log(`[vault-bridge-launch] Vault URL: ${process.env.VAULT_BOT_VAULT_URL ?? "http://localhost:8200"}`);

try {
  await launchVaultBot();
  console.log("[vault-bridge-launch] Vault bridge launched successfully.");
} catch (err: any) {
  console.error("[vault-bridge-launch] Failed to launch:", err?.message ?? String(err));
  process.exit(1);
}
