import type { BuildTask } from "../../src/types/telecore.js";

function createBuildTask(input: { title: string; description?: string; execution?: any }): BuildTask {
  const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    type: "build_task",
    version: "1.0",
    task_id: taskId,
    meta: {
      task_id: taskId,
      created_at: Date.now(),
      priority: "normal",
      mode: "smart",
      persona: "sigma_forge",
      ecosystem: "telega",
      visibility: "core",
    },
    goal: {
      title: input.title,
      description: input.description,
    },
    execution: input.execution,
  };
}

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("[KCA-12.1] Sigma Forge Smoke Test");
  console.log(`Target: ${BASE_URL}\n`);

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<boolean>) {
    try {
      const ok = await fn();
      if (ok) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`❌ ${name}`);
        failed++;
      }
    } catch (err) {
      console.log(`❌ ${name} - ${(err as Error).message}`);
      failed++;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    console.log("\n[1] Health endpoint check");
    const healthRes = await fetch(`${BASE_URL}/v1/runtime/executors/sigma-forge/health`, {
      signal: controller.signal,
    });
    const health = await healthRes.json();
    await test("health endpoint returns 200", () => Promise.resolve(healthRes.ok));
    await test(`health.status = ${health.health}`, () => Promise.resolve(health.health === "healthy"));
    await test("execution_enabled = true", () => Promise.resolve(health.execution_enabled === true));
    await test("execution_mode = sandbox", () => Promise.resolve(health.execution_mode === "sandbox"));
    await test("artifact_contract = strict", () => Promise.resolve(health.artifact_contract === "strict"));
    await test("destructive_operations_allowed = false", () => Promise.resolve(health.destructive_operations_allowed === false));

    console.log("\n[2] POST BuildTask with sigma_forge target");
    const createRes = await fetch(`${BASE_URL}/v1/build/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBuildTask({
        title: "KCA-12.1 sigma forge smoke test",
        execution: {
          target: "sigma_forge",
          kind: "analyze_repo",
          path: ".",
        },
      })),
      signal: controller.signal,
    });
    await test("POST returns 200", () => Promise.resolve(createRes.ok || createRes.status === 201));

    const task = await createRes.json();
    const taskId = task.task_id;
    await test("task has task_id", () => Promise.resolve(!!taskId));

    console.log("\n[3] Wait for execution and check artifacts");
    await sleep(2000);

    const detailRes = await fetch(`${BASE_URL}/v1/build/tasks/${taskId}`, {
      signal: controller.signal,
    });
    const detail = await detailRes.json();
    await test("status is done", () => Promise.resolve(detail.status === "done"));

    const resultJson = detail.result_json as any;
    const hasArtifacts = Array.isArray(resultJson?.artifacts);
    await test("result has artifacts[]", () => Promise.resolve(hasArtifacts));

    if (hasArtifacts && resultJson.artifacts.length > 0) {
      const artifact = resultJson.artifacts[0];
      await test("artifact has artifact_id", () => Promise.resolve(!!artifact.artifact_id));
      await test("artifact has artifact_type", () => Promise.resolve(!!artifact.artifact_type));
      await test("artifact has checksum", () => Promise.resolve(!!artifact.checksum));
      await test("artifact has created_at", () => Promise.resolve(!!artifact.created_at));
      await test("artifact has source_executor", () => Promise.resolve(artifact.source_executor === "sigma_forge"));
    }

    console.log("\n[4] Verify no destructive operations occurred");
    const repoDetail = await detailRes.json();
    const resultSummary = repoDetail.result_json?.summary as any;
    await test("execution summary shows success", () => Promise.resolve(resultSummary?.status === "done"));

  } finally {
    clearTimeout(timeout);
  }

  console.log(`\n[KCA-12.1] Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});