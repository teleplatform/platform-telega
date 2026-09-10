/**
 * Dispatcher SHADOW observation — controlled replay harness.
 *
 * Drives the REAL selection seam (selectProvider → planProviderSelectionV2 →
 * 6C.1 shadow observer → audit store) through a representative request matrix
 * across two health epochs, with DISPATCHER_6C_MODE=shadow semantics.
 *
 * Does NOT change routing behavior, does NOT execute providers, does NOT touch
 * production data when run from a scratch cwd (audit store + dispatcher-6c.json
 * land under process.cwd()/.data and $TELEGPT_DATA_DIR respectively). No
 * prompts, secrets or user content are logged.
 *
 * Usage:
 *   node --import tsx scripts/dispatcher/shadow-observation-run.ts \
 *     --repeat 3 --report docs/dispatcher/SHADOW-WINDOW.md --ndjson out.ndjson
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { createRoutingRegistry } from "@tele-gpt/dispatcher-core";
import {
  ProviderSelectionError,
  selectProvider,
  setDispatcherRoutingObserver,
} from "../../src/core/provider-selection-orchestrator.js";
import {
  recordFailure,
  recordSuccess,
  resetAll,
} from "../../src/core/provider-health-runtime.js";
import {
  resetProviderPolicies,
  resetScoringConfig,
} from "../../src/core/provider-scoring-engine.js";
import {
  clearAuditTrail,
  getAuditCount,
  queryAuditTrail,
} from "../../src/runtime/audit/audit-store.js";
import {
  createDispatcherShadowObserver,
} from "../../src/server/dispatcher/dispatcher-shadow-observer.js";
import {
  setDispatcher6CMode,
  setDispatcherRouterKillSwitch,
} from "../../src/server/dispatcher/dispatcher-mode.js";
import {
  buildDivergenceReport,
  formatAsciiSummary,
  formatMarkdownReport,
} from "./shadow-report-lib.js";

const ROUTING_KINDS = [
  "routing.dispatcher.shadow_decision",
  "routing.dispatcher.error",
] as const;

interface Scenario {
  model: string;
  opts?: { strict?: boolean; noFallback?: boolean; requiredCapabilities?: string[] };
}

const MATRIX: Scenario[] = [
  { model: "auto" },
  { model: "auto", opts: { requiredCapabilities: ["code"] } },
  { model: "auto", opts: { requiredCapabilities: ["reasoning"] } },
  { model: "auto", opts: { requiredCapabilities: ["vision"] } },
  { model: "kimi:kimi-k3" },
  { model: "kimi:prompt-x1" },
  { model: "deepseek:deepseek-r1" },
  { model: "openai:gpt-5" },
  { model: "zyloo:zyloo-mini" },
  { model: "qwen:qwen2.5" },
  { model: "glm:glm-coder" },
  { model: "local:auto" },
  { model: "weirdmodel:xyz" },
  { model: "kimi:kimi-k3", opts: { strict: true } },
  { model: "kimi:kimi-k3", opts: { noFallback: true } },
  { model: "kimi_web:kimi" },
  { model: "chatgpt:gpt-4o" },
  { model: "claude_web:sonnet" },
];

const fail = {
  type: "network",
  shouldRetrySameKey: false,
  shouldCycleCredential: false,
  shouldFallback: true,
  safeMessage: "",
  rawMessage: "",
} as const;

function openCircuit(provider: string) {
  for (let k = 0; k < 5; k++) {
    recordFailure(provider, fail, 200, Date.now());
  }
}

function seedHealthy(providers: string[]) {
  for (const p of providers) recordSuccess(p, 100, Date.now());
}

function seedEpoch(epoch: "healthy" | "degraded") {
  resetAll();
  seedHealthy([
    "openai_api",
    "kimi_api",
    "deepseek_api",
    "zyloo_api",
    "qwen_api",
    "glm_api",
    "local",
  ]);
  openCircuit("kimi_web");
  openCircuit("qwen_web");
  openCircuit("chatgpt_web");
  if (epoch === "degraded") {
    openCircuit("openai_api");
    openCircuit("deepseek_api");
    openCircuit("zyloo_api");
  }
}

function seedRoutingRules() {
  const routing = createRoutingRegistry();
  for (const rule of [
    { id: "rule-default", name: "Default catch-all", priority: 5, enabled: true, condition: {}, action: { routeTo: "openai_api" } },
    { id: "rule-reasoning", name: "Reasoning to kimi", priority: 40, enabled: true, condition: { capability: "reasoning" }, action: { routeTo: "kimi_api" } },
    { id: "rule-code", name: "Code to deepseek", priority: 45, enabled: true, condition: { capability: "code" }, action: { routeTo: "deepseek_api" } },
    { id: "rule-vision", name: "Vision to qwen_web", priority: 35, enabled: true, condition: { capability: "vision" }, action: { routeTo: "qwen_web" } },
    { id: "rule-family-deepseek", name: "deepseek family", priority: 30, enabled: true, condition: { modelFamily: "deepseek" }, action: { routeTo: "deepseek_api" } },
    { id: "rule-family-kimi", name: "kimi family", priority: 30, enabled: true, condition: { modelFamily: "kimi" }, action: { routeTo: "kimi_api" } },
    { id: "rule-latency", name: "Low latency to kimi_web", priority: 50, enabled: true, condition: { maxLatencyMs: 400 }, action: { routeTo: "kimi_web" } },
    { id: "rule-runtime-native", name: "Native runtime to local", priority: 20, enabled: true, condition: { runtimeKind: "native-local" }, action: { routeTo: "local" } },
    { id: "rule-maker-role", name: "Maker role to local", priority: 25, enabled: true, condition: { userRole: "maker" }, action: { routeTo: "local" } },
    { id: "rule-disabled", name: "Disabled (never matches)", priority: 100, enabled: false, condition: {}, action: { routeTo: "zyloo_api" } },
  ]) {
    routing.create(rule as any);
  }
  return routing;
}

function slug(model: string): string {
  return model.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "empty";
}

function parseArgs(argv: string[]) {
  const get = (name: string, fallback: string) => {
    const idx = argv.indexOf(name);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  const cwd = process.cwd();
  const outDir = get("--out", path.join(cwd, ".shadow-out"));
  return {
    repeat: Math.max(1, Number(get("--repeat", "3")) || 3),
    outDir,
    reportPath: get("--report", path.join(outDir, "shadow-divergence-report.md")),
    ndjsonPath: get("--ndjson", path.join(outDir, "shadow-decisions.ndjson")),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startIso = new Date().toISOString();

  const routing = seedRoutingRules();
  setDispatcherRoutingObserver(createDispatcherShadowObserver({ routing }));
  setDispatcher6CMode("shadow");
  setDispatcherRouterKillSwitch(false);
  resetScoringConfig();
  resetProviderPolicies();
  clearAuditTrail();

  let unobserved = 0;
  const terminal: Array<{ requestId: string; model: string; code: string }> = [];

  for (let rep = 0; rep < args.repeat; rep++) {
    for (const epoch of ["healthy", "degraded"] as const) {
      seedEpoch(epoch);
      MATRIX.forEach((scenario, idx) => {
        const requestId = `shadow-${epoch}-${slug(scenario.model)}-${rep + 1}-${idx + 1}`;
        const options: Record<string, unknown> = { requestId };
        if (scenario.opts?.strict) options.strict = true;
        if (scenario.opts?.noFallback) options.noFallback = true;
        if (scenario.opts?.requiredCapabilities) options.requiredCapabilities = scenario.opts.requiredCapabilities;
        try {
          selectProvider(scenario.model, options as Parameters<typeof selectProvider>[1]);
        } catch (e: any) {
          if (e instanceof ProviderSelectionError) {
            unobserved++;
            terminal.push({ requestId, model: scenario.model, code: e.code });
          } else {
            throw e;
          }
        }
      });
    }
  }

  await fs.mkdir(args.outDir, { recursive: true });

  const events = queryAuditTrail({ since: startIso, kinds: [...ROUTING_KINDS] as any, order: "asc" });
  const report = buildDivergenceReport(events, {
    sourceLabel:
      `controlled replay ×${args.repeat} (2 health epochs), planProviderSelectionV2 seam`,
    unobservedSelections: unobserved,
  });

  await fs.writeFile(
    args.ndjsonPath,
    events.map((e) => JSON.stringify(e)).join("\n"),
    "utf8",
  );
  await fs.writeFile(args.reportPath, formatMarkdownReport(report), "utf8");

  console.log(formatAsciiSummary(report));
  console.log("");
  if (terminal.length) {
    console.log(`terminal (unobserved) selection sample (${terminal.length}):`);
    for (const t of terminal.slice(0, 10)) {
      console.log(`  ${t.requestId}  model=${t.model}  ${t.code}`);
    }
  }
  console.log(`\nmarkdown: ${args.reportPath}`);
  console.log(`ndjson : ${args.ndjsonPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});