import { runSystemSmoke } from "./smoke-test.js";
import { getProviderVerificationReport } from "./provider-verification.js";
import fs from "fs/promises";
import path from "path";
import https from "https";
import http from "http";

const DATA_DIR = path.join(process.cwd(), "data");
const VALIDATION_DIR = path.join(DATA_DIR, "validation");
const DOCS_DIR = path.join(process.cwd(), "docs", "validation");

interface SectionStatus {
  name: string;
  status: "PASS" | "WARN" | "FAIL";
  message: string;
  details?: string;
}

interface RuntimeStatusReport {
  timestamp: number;
  overall: "PASS" | "WARN" | "FAIL";
  sections: SectionStatus[];
}

async function httpGet(url: string): Promise<{ ok: boolean; status?: number; latency: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, (res) => {
      const latency = Date.now() - start;
      resolve({ ok: res.statusCode === 200, status: res.statusCode, latency });
      req.destroy();
    });
    req.on("error", () => {
      const latency = Date.now() - start;
      resolve({ ok: false, latency });
    });
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ ok: false, latency: Date.now() - start });
    });
  });
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

export async function getRuntimeStatus(): Promise<RuntimeStatusReport> {
  const sections: SectionStatus[] = [];
  const t0 = Date.now();

  // 1. System Smoke
  try {
    const smoke = await runSystemSmoke();
    sections.push({
      name: "System Smoke",
      status: smoke.overall,
      message: `Pass: ${smoke.pass_count}, Warn: ${smoke.warn_count}, Fail: ${smoke.fail_count}`,
      details: smoke.results.filter((r) => r.status !== "PASS").map((r) => `${r.status}: ${r.check}`).join(", "),
    });
  } catch (e: any) {
    sections.push({ name: "System Smoke", status: "FAIL", message: e?.message });
  }

  // 2. E2E Validation
  try {
    const e2ePath = path.join(VALIDATION_DIR, "e2e-validation-v2.jsonl");
    const content = await fs.readFile(e2ePath, "utf-8").catch(() => "");
    const lines = content.trim().split("\n").filter(Boolean);
    const e2e = lines.length > 0 ? JSON.parse(lines[lines.length - 1]) : null;
    if (e2e) {
      const pass = e2e.summary?.pass || 0;
      const warn = e2e.summary?.warn || 0;
      sections.push({
        name: "E2E Validation",
        status: pass > 0 && warn < pass ? "PASS" : "WARN",
        message: `Pass: ${pass}, Warn: ${warn}, Fail: ${e2e.summary?.fail || 0}`,
      });
    } else {
      sections.push({ name: "E2E Validation", status: "WARN", message: "No validation run" });
    }
  } catch (e: any) {
    sections.push({ name: "E2E Validation", status: "WARN", message: e?.message });
  }

  // 3. Provider Verification
  try {
    const pv = await getProviderVerificationReport();
    const pass = pv.summary.pass;
    const warn = pv.summary.warn;
    const fail = pv.summary.fail;
    const rate = pv.summary.rate_limit;
    sections.push({
      name: "Provider Verify",
      status: pass > 0 && fail < pass ? "PASS" : "WARN",
      message: `Pass: ${pass}, Warn: ${warn}, Fail: ${fail}, RateLimit: ${rate}`,
      details: pv.results.filter((r: any) => r.status !== "PASS").map((r: any) => `${r.status}: ${r.provider}`).join(", "),
    });
  } catch (e: any) {
    sections.push({ name: "Provider Verify", status: "WARN", message: e?.message });
  }

  // 4. Storage Health
  try {
    const storageApi = await httpGet("http://127.0.0.1:8787/health");
    sections.push({
      name: "Storage API",
      status: storageApi.ok ? "PASS" : "FAIL",
      message: storageApi.ok ? `OK (${storageApi.latency}ms)` : `HTTP ${storageApi.status}`,
    });
  } catch (e: any) {
    sections.push({ name: "Storage API", status: "FAIL", message: e?.message });
  }

  // 5. Bridge Health
  try {
    const bridgeStatus = await httpGet("http://127.0.0.1:8787/api/bridge").catch(() => ({ ok: false, latency: 0 }));
    sections.push({
      name: "Bridge",
      status: bridgeStatus.ok ? "PASS" : "FAIL",
      message: bridgeStatus.ok ? "OK" : "Not responding",
    });
  } catch (e: any) {
    sections.push({ name: "Bridge", status: "FAIL", message: e?.message });
  }

  // 6. Forge Runtime
  try {
    const forgePath = path.join(DATA_DIR, "forge", "workflows.jsonl");
    const content = await fs.readFile(forgePath, "utf-8").catch(() => "");
    const lines = content.trim().split("\n").filter(Boolean);
    const active = lines.filter((l) => !l.includes("complete")).length;
    sections.push({
      name: "Forge",
      status: "PASS",
      message: `${lines.length} workflows, ${active} active`,
    });
  } catch (e: any) {
    sections.push({ name: "Forge", status: "FAIL", message: e?.message });
  }

  // 7. MCP Status
  try {
    const mcp = await httpGet("http://127.0.0.1:8787/mcp/status").catch(() => ({ ok: false, latency: 0 }));
    sections.push({
      name: "MCP",
      status: mcp.ok ? "PASS" : "WARN",
      message: mcp.ok ? "Running" : "Not configured",
    });
  } catch (e: any) {
    sections.push({ name: "MCP", status: "WARN", message: "Optional" });
  }

  // 8. Kilo Status
  try {
    const kiloPath = path.join(DATA_DIR, "telegram", "kilo-execution.jsonl");
    const content = await fs.readFile(kiloPath, "utf-8").catch(() => "");
    const lines = content.trim().split("\n").filter(Boolean);
    sections.push({
      name: "Kilo",
      status: "PASS",
      message: `${lines.length} executions`,
    });
  } catch (e: any) {
    sections.push({ name: "Kilo", status: "WARN", message: "No executions yet" });
  }

  let overall: RuntimeStatusReport["overall"] = "PASS";
  const failCount = sections.filter((s) => s.status === "FAIL").length;
  const warnCount = sections.filter((s) => s.status === "WARN").length;
  if (failCount > 0) overall = "FAIL";
  else if (warnCount > sections.length / 2) overall = "WARN";

  const report: RuntimeStatusReport = {
    timestamp: Date.now(),
    overall,
    sections,
  };

  await ensureDir(DOCS_DIR);
  const md = `# Runtime Status Report

**Timestamp:** ${new Date(report.timestamp).toISOString()}
**Overall:** ${report.overall}

## Sections

${sections.map((s) => `### ${s.name}

- **Status:** ${s.status}
- **Message:** ${s.message}
${s.details ? `- **Details:** ${s.details}` : ""}
`).join("\n")}

---
Generated at ${new Date().toISOString()}
`;

  await fs.writeFile(path.join(DOCS_DIR, "RUNTIME_STATUS_latest.md"), md);

  console.log("[runtime_status] Generated in", Date.now() - t0, "ms");

  return report;
}