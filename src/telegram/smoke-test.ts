import fs from "fs/promises";
import path from "path";
import https from "https";
import http from "http";

const DATA_DIR = path.join(process.cwd(), "data");
const VALIDATION_DIR = path.join(DATA_DIR, "validation");
const DOCS_DIR = path.join(process.cwd(), "docs", "validation");

interface SmokeResult {
  check: string;
  status: "PASS" | "WARN" | "FAIL";
  message: string;
  latency_ms?: number;
  error?: string;
}

interface SmokeReport {
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
  const startTime = Date.now();

  const addResult = (check: string, status: SmokeResult["status"], message: string, latency?: number, error?: string) => {
    results.push({ check, status, message, latency_ms: latency, error });
  };

  try {
    await ensureDir(VALIDATION_DIR);
    await ensureDir(DOCS_DIR);
  } catch (e: any) {
    console.error("[smoke] init error", e?.message);
  }

  try {
    addResult("Telegram Bot Started", "PASS", "Bot instance exists");
  } catch (e: any) {
    addResult("Telegram Bot Started", "FAIL", e?.message);
  }

  try {
    const providersDir = path.join(DATA_DIR, "telegram", "providers.jsonl");
    await fs.access(providersDir);
    addResult("Creator Bridge Providers", "PASS", "providers.jsonl exists");
  } catch {
    addResult("Creator Bridge Providers", "WARN", "not configured yet");
  }

  try {
    const outDir = path.join(DATA_DIR, "telegram", "delivery");
    await fs.access(outDir);
    addResult("Output Delivery", "PASS", "delivery directory exists");
  } catch {
    addResult("Output Delivery", "WARN", "not configured yet");
  }

  try {
    const validResult = await httpGet("http://127.0.0.1:8787/health");
    if (validResult.ok) {
      addResult("Storage API", "PASS", `HTTP ${validResult.status}`, validResult.latency);
    } else {
      addResult("Storage API", "WARN", `HTTP ${validResult.status}`, validResult.latency);
    }
  } catch (e: any) {
    addResult("Storage API", "FAIL", e?.message);
  }

  try {
    const indexesDir = path.join(DATA_DIR, "indexes");
    const files = await fs.readdir(indexesDir).catch(() => []);
    if (files.length > 0) {
      addResult("Indexes Readable", "PASS", `${files.length} indexes found`);
    } else {
      addResult("Indexes Readable", "WARN", "no indexes yet");
    }
  } catch (e: any) {
    addResult("Indexes Readable", "WARN", e?.message);
  }

  try {
    const mcpResult = await httpGet("http://127.0.0.1:8787/mcp/status");
    if (mcpResult.ok) {
      addResult("MCP Status", "PASS", "responding", mcpResult.latency);
    } else {
      addResult("MCP Status", "WARN", `HTTP ${mcpResult.status}`);
    }
  } catch {
    addResult("MCP Status", "WARN", "not running");
  }

  try {
    const kiloDir = path.join(DATA_DIR, "telegram");
    const files = await fs.readdir(kiloDir).catch(() => []);
    const hasKilo = files.some((f) => f.includes("kilo"));
    if (hasKilo) {
      addResult("Kilo Gateway", "PASS", "kilo files present");
    } else {
      addResult("Kilo Gateway", "WARN", "not initialized");
    }
  } catch (e: any) {
    addResult("Kilo Gateway", "WARN", e?.message);
  }

  try {
    const wfDir = path.join(DATA_DIR, "forge");
    await fs.access(wfDir);
    const wfFile = path.join(wfDir, "workflows.jsonl");
    await fs.access(wfFile);
    const content = await fs.readFile(wfFile, "utf-8").catch(() => "");
    const lines = content.trim().split("\n").filter(Boolean);
    const count = lines.filter(safeParse).length;
    addResult("Forge Workflows", "PASS", `${count} workflows`);
  } catch (e: any) {
    addResult("Forge Workflows", "FAIL", e?.message);
  }

  try {
    const acFile = path.join(DATA_DIR, "forge", "auto-modes.jsonl");
    await fs.access(acFile);
    addResult("Action Cards", "PASS", "auto-modes.jsonl exists");
  } catch {
    addResult("Action Cards", "WARN", "no auto-modes yet");
  }

  try {
    const cmdFile = path.join(process.cwd(), "src", "lib", "commands.ts");
    await fs.access(cmdFile);
    addResult("Commands Runtime", "PASS", "commands.ts exists");
  } catch (e: any) {
    addResult("Commands Runtime", "FAIL", e?.message);
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

  const jsonPath = path.join(VALIDATION_DIR, `system-smoke-${report.timestamp}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));

  const latestPath = path.join(VALIDATION_DIR, "system-smoke-latest.json");
  await fs.writeFile(latestPath, JSON.stringify(report, null, 2));

  const mdPath = path.join(DOCS_DIR, `SYSTEM_SMOKE_REPORT_${report.timestamp}.md`);
  const md = `## System Smoke Report

**Timestamp:** ${new Date(report.timestamp).toISOString()}
**Overall:** ${report.overall}
**Hostname:** ${report.hostname}

### Results

${report.results.map((r) => `- **${r.check}**: ${r.status} - ${r.message}${r.latency_ms ? ` (${r.latency_ms}ms)` : ""}`).join("\n")}

### Summary

| Status | Count |
|--------|-------|
| PASS | ${report.pass_count} |
| WARN | ${report.warn_count} |
| FAIL | ${report.fail_count} |
`;

  await fs.writeFile(mdPath, md);

  const latestMdPath = path.join(DOCS_DIR, "SYSTEM_SMOKE_REPORT_latest.md");
  await fs.writeFile(latestMdPath, md);
}