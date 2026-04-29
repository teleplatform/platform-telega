import fs from "fs/promises";
import path from "path";
import { runSystemSmoke } from "./smoke-test.js";
import { getProviderVerificationReport } from "./provider-verification.js";
import { getRealMarketStats } from "./real-market.js";
import { getMemoryStatus } from "./memory-stack.js";

const DATA_DIR = path.join(process.cwd(), "data");
const VALIDATION_DIR = path.join(DATA_DIR, "validation");

interface LaunchCheck {
  id: string;
  name: string;
  status: "block" | "warning" | "ready";
  message: string;
  details?: string;
  checked_at?: number;
}

interface LaunchReadiness {
  overall: "blocked" | "warning" | "ready";
  checks: LaunchCheck[];
  timestamp: number;
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

async function logEvent(event: string, data: object): Promise<void> {
  await ensureDir(VALIDATION_DIR);
  const file = path.join(VALIDATION_DIR, "launch-audit.jsonl");
  const line = JSON.stringify({ event, ...data, timestamp: Date.now() });
  await fs.appendFile(file, line + "\n");
}

export async function runLaunchCheck(): Promise<LaunchReadiness> {
  const checks: LaunchCheck[] = [];
  let blockCount = 0;
  let warnCount = 0;

  // 1. System Smoke
  try {
    const smoke = await runSystemSmoke();
    const isPass = smoke.overall === "PASS";
    checks.push({
      id: "system_smoke",
      name: "System Smoke",
      status: isPass ? "ready" : "block",
      message: isPass ? "All checks pass" : `${smoke.fail_count} failed checks`,
      details: `Pass: ${smoke.pass_count}, Warn: ${smoke.warn_count}, Fail: ${smoke.fail_count}`,
    });
    if (smoke.fail_count > 0) blockCount++;
  } catch (e: any) {
    checks.push({
      id: "system_smoke",
      name: "System Smoke",
      status: "block",
      message: e?.message || "Check failed",
    });
    blockCount++;
  }

  // 2. Provider Verification
  try {
    const pv = await getProviderVerificationReport();
    const hasVerified = pv.summary.pass > 0;
    checks.push({
      id: "providers",
      name: "Providers Verified",
      status: hasVerified ? "ready" : "warning",
      message: hasVerified ? `${pv.summary.pass} verified` : "No providers verified",
      details: `Pass: ${pv.summary.pass}, Fail: ${pv.summary.fail}`,
    });
    if (!hasVerified) warnCount++;
  } catch (e: any) {
    checks.push({
      id: "providers",
      name: "Providers Verified",
      status: "warning",
      message: "Could not verify",
    });
    warnCount++;
  }

  // 3. Storage Valid
  try {
    await fs.access(path.join(DATA_DIR, "validation", "e2e-validation-v2.jsonl"));
    checks.push({
      id: "storage",
      name: "Storage Valid",
      status: "ready",
      message: "Storage accessible",
    });
  } catch {
    checks.push({
      id: "storage",
      name: "Storage Valid",
      status: "warning",
      message: "No validation data yet",
    });
    warnCount++;
  }

  // 4. Marketplace Ready
  try {
    const market = await getRealMarketStats();
    const hasProducts = market.total_offers > 0;
    checks.push({
      id: "marketplace",
      name: "Marketplace Ready",
      status: hasProducts ? "ready" : "warning",
      message: hasProducts ? `${market.total_offers} products` : "No products yet",
      details: `Offers: ${market.total_offers}, Orders: ${market.total_orders}`,
    });
    if (!hasProducts) warnCount++;
  } catch (e: any) {
    checks.push({
      id: "marketplace",
      name: "Marketplace Ready",
      status: "warning",
      message: "Could not check",
    });
    warnCount++;
  }

  // 5. Wallet Ready
  try {
    await fs.access(path.join(DATA_DIR, "marketplace", "wallet.jsonl"));
    checks.push({
      id: "wallet",
      name: "Wallet Ready",
      status: "ready",
      message: "Wallet file exists",
    });
  } catch {
    checks.push({
      id: "wallet",
      name: "Wallet Ready",
      status: "warning",
      message: "No wallet yet (optional)",
    });
    warnCount++;
  }

  // 6. Seller Onboarding
  try {
    await fs.access(path.join(DATA_DIR, "marketplace", "sellers.jsonl"));
    const sellersContent = await fs.readFile(path.join(DATA_DIR, "marketplace", "sellers.jsonl"), "utf-8");
    const sellers = sellersContent.trim().split("\n").filter(Boolean);
    checks.push({
      id: "seller_onboarding",
      name: "Seller Onboarding",
      status: "ready",
      message: "Seller onboarding ready",
      details: `${sellers.length} sellers`,
    });
  } catch {
    checks.push({
      id: "seller_onboarding",
      name: "Seller Onboarding",
      status: "warning",
      message: "No sellers yet",
    });
    warnCount++;
  }

  // 7. Ads Ready
  try {
    await fs.access(path.join(DATA_DIR, "marketplace", "campaigns.jsonl"));
    checks.push({
      id: "ads",
      name: "Ads Ready",
      status: "ready",
      message: "Ads system ready",
    });
  } catch {
    checks.push({
      id: "ads",
      name: "Ads Ready",
      status: "warning",
      message: "No campaigns yet (optional)",
    });
    warnCount++;
  }

  // 8. Analytics Ready (Memory)
  try {
    const memory = await getMemoryStatus();
    const hasMemory = memory.tektite_count > 0 || memory.oblivion_count > 0;
    checks.push({
      id: "analytics",
      name: "Analytics Ready",
      status: hasMemory ? "ready" : "warning",
      message: hasMemory ? "Memory available" : "No memory yet",
      details: `Tektite: ${memory.tektite_count}, Oblivion: ${memory.oblivion_count}`,
    });
    if (!hasMemory) warnCount++;
  } catch (e: any) {
    checks.push({
      id: "analytics",
      name: "Analytics Ready",
      status: "warning",
      message: "Could not check",
    });
    warnCount++;
  }

  let overall: LaunchReadiness["overall"] = "ready";
  if (blockCount > 0) overall = "blocked";
  else if (warnCount > 4) overall = "warning";

  const report: LaunchReadiness = {
    overall,
    checks,
    timestamp: Date.now(),
  };

  await ensureDir(VALIDATION_DIR);
  await fs.writeFile(
    path.join(VALIDATION_DIR, "launch-readiness.json"),
    JSON.stringify(report, null, 2)
  );

  const DOCS_DIR = path.join(process.cwd(), "docs", "validation");
  await ensureDir(DOCS_DIR);

  const md = `# Launch Readiness Report v1

**Generated:** ${new Date(report.timestamp).toISOString()}
**Overall:** ${report.overall.toUpperCase()}

## Checks

| Check | Status | Message |
|-------|-------|--------|
${checks.map((c) => `| ${c.name} | ${c.status.toUpperCase()} | ${c.message} |`).join("\n")}

## Summary

- Blocked: ${blockCount}
- Warnings: ${warnCount}
- Ready: ${checks.length - blockCount - warnCount}

---
Generated at ${new Date().toISOString()}
`;

  await fs.writeFile(path.join(DOCS_DIR, "LAUNCH_READINESS_V1.md"), md);

  await logEvent("launch_check_completed", {
    overall,
    block_count: blockCount,
    warn_count: warnCount,
  });

  console.log("[launch] Readiness:", overall);

  return report;
}

export async function getLaunchBlockers(): Promise<string[]> {
  const report = await runLaunchCheck();
  return report.checks
    .filter((c) => c.status === "block")
    .map((c) => c.name);
}

export async function isLaunchReady(): Promise<boolean> {
  const report = await runLaunchCheck();
  return report.overall === "ready";
}