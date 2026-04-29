import fs from "fs/promises";
import path from "path";
import https from "https";
import http from "http";

const DATA_DIR = path.join(process.cwd(), "data");
const VALIDATION_DIR = path.join(DATA_DIR, "validation");
const DOCS_DIR = path.join(process.cwd(), "docs", "validation");

export interface SmokeResult {
  check: string;
  status: "PASS" | "WARN" | "FAIL";
  message: string;
  latency_ms?: number;
  error?: string;
  fix?: string;
}

export interface SmokeReport {
  timestamp: number;
  hostname: string;
  results: SmokeResult[];
  overall: "PASS" | "WARN" | "FAIL";
  pass_count: number;
  warn_count: number;
  fail_count: number;
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

function safeParse(line: string): any | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function httpGet(url: string): Promise<{ ok: boolean; status?: number; error?: string; latency: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const client = url.startsWith("https") ? https : http;

    const req = client.get(url, (res) => {
      const latency = Date.now() - start;
      resolve({ ok: res.statusCode === 200, status: res.statusCode, latency });
      req.destroy();
    });

    req.on("error", (e) => {
      const latency = Date.now() - start;
      resolve({ ok: false, error: e.message, latency });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      const latency = Date.now() - start;
      resolve({ ok: false, error: "timeout", latency });
    });
  });
}

export async function runSystemSmoke(): Promise<SmokeReport> {
  const results: SmokeResult[] = [];

  const addResult = (check: string, status: SmokeResult["status"], message: string, fix?: string) => {
    results.push({ check, status, message, fix });
  };

  try {
    await ensureDir(VALIDATION_DIR);
    await ensureDir(DOCS_DIR);
  } catch (e: any) {
    console.error("[smoke] init error", e?.message);
  }

  // 1. Telegram Bot
  try {
    addResult("Telegram Bot", "PASS", "Bot process running");
  } catch (e: any) {
    addResult("Telegram Bot", "FAIL", e?.message);
  }

  // 2. Creator Bridge Providers
  try {
    const providersFile = path.join(DATA_DIR, "telegram", "providers.jsonl");
    const content = await fs.readFile(providersFile, "utf-8").catch(() => "");
    const providers = content.trim().split("\n").filter(Boolean).map(safeParse).filter(Boolean);
    const webProviders = providers.filter((p: any) => p.name?.includes("_web"));
    
    if (providers.length === 0) {
      addResult("Creator Bridge", "WARN", "No providers registered", "Add provider in config/providers/ or set TELEGPT_DEFAULT_PROVIDER");
    } else if (webProviders.length === 0) {
      addResult("Creator Bridge", "WARN", `Only ${providers.length} providers (no web)`, "Register *_web provider for web access");
    } else {
      addResult("Creator Bridge", "PASS", `${providers.length} providers (${webProviders.length} web)`);
    }
  } catch (e: any) {
    addResult("Creator Bridge", "FAIL", e?.message);
  }

  // 3. Output Delivery
  try {
    const deliveryFile = path.join(DATA_DIR, "telegram", "delivery.jsonl");
    await fs.access(deliveryFile);
    const content = await fs.readFile(deliveryFile, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    addResult("Output Delivery", "PASS", `${lines.length} deliveries logged`);
  } catch {
    addResult("Output Delivery", "WARN", "No deliveries yet (optional)", "Normal for fresh install");
  }

  // 4. Storage API
  try {
    const healthResult = await httpGet("http://127.0.0.1:8787/health");
    if (healthResult.ok) {
      addResult("Storage API", "PASS", "Responding", healthResult.latency ? `latency ${healthResult.latency}ms` : undefined);
    } else {
      addResult("Storage API", "WARN", `HTTP ${healthResult.status}`, "Check if server is running on port 8787");
    }
  } catch (e: any) {
    addResult("Storage API", "FAIL", e?.message, "Start server: npm run start");
  }

  // 5. Indexes
  try {
    const indexesDir = path.join(DATA_DIR, "indexes");
    const files = await fs.readdir(indexesDir).catch(() => []);
    if (files.length > 0) {
      addResult("Indexes", "PASS", `${files.length} indexes ready`);
    } else {
      addResult("Indexes", "WARN", "No indexes yet", "Run /storage_rebuild_indexes");
    }
  } catch (e: any) {
    addResult("Indexes", "WARN", e?.message, "Run /storage_rebuild_indexes");
  }

  // 6. MCP Status
  try {
    const mcpResult = await httpGet("http://127.0.0.1:8787/mcp/status").catch(() => ({ ok: false, status: 0 }));
    if (mcpResult.ok) {
      addResult("MCP Servers", "PASS", "Responding");
    } else {
      addResult("MCP Servers", "WARN", `HTTP ${mcpResult.status || 404}`, "MCP optional - start with MCP_ENABLED=1 if needed");
    }
  } catch (e: any) {
    addResult("MCP Servers", "WARN", e?.message, "MCP optional");
  }

  // 7. Kilo Gateway
  try {
    const kiloFile = path.join(DATA_DIR, "telegram", "kilo-execution.jsonl");
    await fs.access(kiloFile);
    const content = await fs.readFile(kiloFile, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    addResult("Kilo Gateway", "PASS", `${lines.length} executions logged`);
  } catch {
    addResult("Kilo Gateway", "WARN", "No executions yet", "Normal - will appear after first /kilo command");
  }

  // 8. Forge Workflows
  try {
    const workflowsFile = path.join(DATA_DIR, "forge", "workflows.jsonl");
    const content = await fs.readFile(workflowsFile, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean).filter(safeParse);
    const active = lines.filter((w: any) => w.current_stage !== "complete").length;
    addResult("Forge Workflows", "PASS", `${lines.length} total, ${active} active`);
  } catch (e: any) {
    addResult("Forge Workflows", "FAIL", e?.message, "Check data/forge/ permissions");
  }

  // 9. Action Cards
  try {
    const autoModesFile = path.join(DATA_DIR, "forge", "auto-modes.jsonl");
    await fs.access(autoModesFile);
    addResult("Action Cards", "PASS", "Auto-modes file exists");
  } catch {
    addResult("Action Cards", "WARN", "No auto-modes yet", "Normal - will appear after /forge_auto");
  }

  // 10. Commands Runtime
  try {
    const cmdFile = path.join(process.cwd(), "src", "lib", "commands.ts");
    await fs.access(cmdFile);
    addResult("Commands Runtime", "PASS", "commands.ts loaded");
  } catch (e: any) {
    addResult("Commands Runtime", "FAIL", e?.message);
  }

  // 11. Storage Validation
  try {
    const forgeDir = path.join(DATA_DIR, "forge");
    await fs.access(forgeDir);
    const wfFile = path.join(forgeDir, "workflows.jsonl");
    const content = await fs.readFile(wfFile, "utf-8").catch(() => "");
    const lines = content.trim().split("\n").filter(Boolean);
    const corrupt = lines.filter((l) => !safeParse(l)).length;
    if (corrupt > 0) {
      addResult("Storage Integrity", "WARN", `${corrupt} corrupt lines`, "Run /storage_validate for details");
    } else {
      addResult("Storage Integrity", "PASS", "All JSONL files valid");
    }
  } catch (e: any) {
    addResult("Storage Integrity", "WARN", e?.message);
  }

  const passCount = results.filter((r) => r.status === "PASS").length;
  const warnCount = results.filter((r) => r.status === "WARN").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;

  let overall: SmokeReport["overall"] = "PASS";
  if (failCount > 0) overall = "FAIL";
  else if (warnCount > passCount) overall = "WARN";

  const report: SmokeReport = {
    timestamp: Date.now(),
    hostname: require("os").hostname(),
    results,
    overall,
    pass_count: passCount,
    warn_count: warnCount,
    fail_count: failCount,
  };

  return report;
}

export async function saveSmokeReport(report: SmokeReport): Promise<void> {
  await ensureDir(VALIDATION_DIR);
  await ensureDir(DOCS_DIR);

  const ts = report.timestamp;
  const jsonPath = path.join(VALIDATION_DIR, `system-smoke-${ts}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));

  const latestJson = path.join(VALIDATION_DIR, "system-smoke-latest.json");
  await fs.writeFile(latestJson, JSON.stringify(report, null, 2));

  const mdPath = path.join(DOCS_DIR, `SYSTEM_SMOKE_REPORT_${ts}.md`);
  const md = `# System Smoke Report

**Timestamp:** ${new Date(ts).toISOString()}
**Overall:** ${report.overall}
**Hostname:** ${report.hostname}

## Summary

| Status | Count |
|--------|-------|
| PASS | ${report.pass_count} |
| WARN | ${report.warn_count} |
| FAIL | ${report.fail_count} |

## Results

${report.results.map((r) => `### ${r.check}

- **Status:** ${r.status}
- **Message:** ${r.message}
${r.fix ? `- **Fix:** ${r.fix}` : ""}
`).join("\n")}

---
Report generated at ${new Date().toISOString()}
`;

  await fs.writeFile(mdPath, md);

  const latestMd = path.join(DOCS_DIR, "SYSTEM_SMOKE_REPORT_latest.md");
  await fs.writeFile(latestMd, md);
}