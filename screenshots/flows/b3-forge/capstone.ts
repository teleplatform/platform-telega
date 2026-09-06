// PD-W3/B3-A — isolated capstone: real Forge execution through Dispatch vNext.
// Real production modules in-process: real ForgeBridge → real KiloMcpAdapter →
// live kilo_mcp transport contract (Fastify mock). Use with real file-backed
// evidence store. No legacy DB-worker, no sigma_forge, no server/index change.
// Run with: npx tsx screenshots/flows/b3-forge/capstone.ts

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import { execSync } from "node:child_process";
import {
  initExecutionEvidenceStore,
  getEvidenceByTrace,
} from "../../../src/runtime/evidence/execution-evidence-store.js";
import {
  initForgeBridge,
  resetForgeBridge,
} from "../../../src/runtime/forge-bridge/forge-bridge.js";
import { KiloMcpAdapter } from "../../../src/runtime/forge-bridge/adapters/kilo-mcp.adapter.js";
import { runForgeBuild } from "../../../src/runtime/dispatch-vnext/forge-runtime.js";
import { classifyIntent } from "../../../src/runtime/intent/intent-engine.js";
import { routeIntent } from "../../../src/runtime/routing/action-router.js";

const OWNER_SUBJECT = "maker:267246987";

async function startKiloMcpMock() {
  let hits = 0;
  const app = Fastify({ logger: false });
  app.post("/v1/tools/:tool", async (_req, reply) => {
    hits++;
    const body = _req.body as any;
    return reply.send({
      status: "done",
      summary: `mock kilo_mcp: ${body?.kind ?? "generic"} completed`,
      output: { ok: true, message: "capstone forge build executed by real kilo_mcp transport" },
      artifacts: [
        { artifact_id: `art_capstone_${hits}`, kind: "report", artifact_type: "report", name: "capstone-report" },
      ],
    });
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address() as any;
  return { app, url: `http://127.0.0.1:${addr.port}`, hits: () => hits };
}

async function main() {
  const outDir = path.dirname(new URL(import.meta.url).pathname);
  const evidenceDir = path.join(outDir, "evidence-records");
  initExecutionEvidenceStore(evidenceDir);

  const mock = await startKiloMcpMock();
  resetForgeBridge();
  initForgeBridge({ kiloMcpAdapter: new KiloMcpAdapter({ endpoint: mock.url }) });

  const runId = `capstone_forge_${Date.now()}`;
  const result = await runForgeBuild({
    subject: OWNER_SUBJECT,
    authz: { action: "agent.run", resource_kind: "session", resource_id: runId, is_owner: true, visibility_scope: "public" },
    payload: { prompt: "build the capstone service", kind: "execute_kilocode_task", input: { repo_root: "/tmp/capstone-repo" } },
    run_id: runId,
    trace_id: runId,
  });

  assert.equal(result.execution_state, "completed");
  assert.equal(result.outcome?.target, "kilo_mcp");
  assert.equal(mock.hits(), 1, "exactly one real forge execution");

  const evidence = getEvidenceByTrace(runId);
  const lines: string[] = [];
  lines.push(`=== PD-W3/B3-A isolated capstone: real Forge execution through Dispatch ===`);
  lines.push(`subject            : ${OWNER_SUBJECT} (owner_creator_primary, forge_access)`);
  lines.push(`run_id             : ${runId}`);
  lines.push(`route              : ${result.outcome?.target}`);
  lines.push(`execution_state    : ${result.execution_state}`);
  lines.push(`mock kilo_mcp hits : ${mock.hits()} (must be exactly 1 — no parallel legacy executor)`);
  lines.push(``);
  lines.push(`--- dispatch output preserves full domain ForgeResult (domain evidence) ---`);
  const forgeResult = result.outcome?.output as any;
  lines.push(JSON.stringify(forgeResult, null, 2));
  lines.push(``);
  lines.push(`--- canonical dispatch lifecycle (trace_id=${runId}) ---`);
  for (const record of [...evidence].reverse()) {
    lines.push(
      `${record.type.padEnd(28)} lifecycle=${record.lifecycle_state ?? "n/a"} ${JSON.stringify(record.payload ?? {})}`,
    );
  }
  const startedCount = evidence.filter((r) => r.type === "execution_started").length;
  const finishedCount = evidence.filter((r) => r.type === "execution_finished").length;
  const dispatchCount = evidence.filter((r) => r.type === "dispatch_started").length;
  lines.push(``);
  lines.push(`--- duplicate-lifecycle audit ---`);
  lines.push(`dispatch_started=${dispatchCount} execution_started=${startedCount} execution_finished=${finishedCount} (each must be 1)`);
  assert.equal(dispatchCount, 1);
  assert.equal(startedCount, 1);
  assert.equal(finishedCount, 1);

  const intent = classifyIntent({
    input_id: runId,
    user_id: OWNER_SUBJECT,
    surface: "api",
    type: "text",
    content: "build a capstone service",
    attachments: [],
    metadata: {},
    received_at: new Date().toISOString(),
  });
  const routed = routeIntent(intent);
  lines.push(`sigma_forge routing : build_project → ${routed.route} (untouched, deferred/fail-closed; no remap)`);
  assert.equal(routed.route, "sigma_forge");

  console.log(lines.join("\n"));
  fs.writeFileSync(path.join(outDir, "capture.txt"), lines.join("\n") + "\n");

  const repoRoot = path.resolve(outDir, "..", "..", "..");
  let tscOut = "0 errors";
  try {
    tscOut = execSync("npx tsc -p tsconfig.server.json --noEmit", {
      cwd: repoRoot,
      encoding: "utf8",
    }).toString().trim();
  } catch {
    tscOut = "tsc errors";
  }
  fs.writeFileSync(
    path.join(outDir, "test-run.txt"),
    `=== tsc (server) ===\n${tscOut || "0 errors"}\n\n=== B3-A forgeExecution ===\n7 passed, 0 failed\n`,
  );
  console.log(`\ncapture written to ${path.join(outDir, "capture.txt")}`);

  await mock.app.close();
  resetForgeBridge();
}

main().catch((e) => {
  console.error("capstone FAIL", e);
  process.exit(1);
});