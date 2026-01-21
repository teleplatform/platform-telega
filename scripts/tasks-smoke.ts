import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

import { buildServer } from "../src/server/p2_storage.ts";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function buildTaskPayload(now: number) {
  return {
    type: "build_task",
    version: "1.0",
    meta: {
      task_id: "auto",
      created_at: now,
      priority: "normal",
      mode: "smart",
      persona: "tele-gpt",
      ecosystem: "telega",
      visibility: "creator",
    },
    goal: {
      title: `Smoke task ${now}`,
      description: "smoke",
    },
    spec: {
      skill_kind: "support_ticket",
      title: "Smoke",
    },
  };
}

function buildResultPayload(task_id: string, status: "done" | "partial" | "blocked") {
  return {
    type: "build_result",
    version: "1.0",
    summary: {
      task_id,
      status,
    },
    artifacts: [],
  };
}

async function main() {
  // Maker-only endpoints (not strictly required here, but canonical)
  process.env.TELEGA_MODE = "creator";

  // Make stale detection fast
  process.env.TELEGPT_TASK_STALE_MS = "25";

  const tmpDir = path.join(
    process.cwd(),
    ".data",
    `_smoke_tasks_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
  fs.mkdirSync(tmpDir, { recursive: true });
  process.env.TELEGPT_DATA_DIR = tmpDir;

  const app = await buildServer();

  try {
    // --- P8: stale runner heartbeat -> sweep-stale marks blocked
    const now1 = Date.now();
    const create1 = await app.inject({
      method: "POST",
      url: "/v1/build/tasks",
      payload: buildTaskPayload(now1),
    });
    assert.equal(create1.statusCode, 200);
    const task1 = (create1.json() as any).task_id as string;
    assert.ok(task1);

    const hb1 = await app.inject({
      method: "POST",
      url: `/v1/build/tasks/${task1}/heartbeat`,
      payload: { runner_id: "smoke", progress: 1 },
    });
    assert.equal(hb1.statusCode, 200);

    const sweepFresh = await app.inject({
      method: "POST",
      url: "/v1/build/tasks/sweep-stale",
    });
    assert.equal(sweepFresh.statusCode, 200);
    const sweepFreshJson = sweepFresh.json() as any;
    assert.equal(sweepFreshJson.marked_blocked, 0);

    await sleep(40);

    const sweepStale = await app.inject({
      method: "POST",
      url: "/v1/build/tasks/sweep-stale",
    });
    assert.equal(sweepStale.statusCode, 200);
    const sweepStaleJson = sweepStale.json() as any;
    assert.equal(sweepStaleJson.marked_blocked, 1);

    const get1 = await app.inject({
      method: "GET",
      url: `/v1/build/tasks/${task1}`,
    });
    assert.equal(get1.statusCode, 200);
    const get1Json = get1.json() as any;
    assert.equal(get1Json.status, "blocked");
    assert.equal(get1Json.error_code, "STALE_HEARTBEAT");

    // --- P11: terminal status regression is blocked (409)
    const now2 = Date.now();
    const create2 = await app.inject({
      method: "POST",
      url: "/v1/build/tasks",
      payload: buildTaskPayload(now2),
    });
    assert.equal(create2.statusCode, 200);
    const task2 = (create2.json() as any).task_id as string;
    assert.ok(task2);

    const resDone = await app.inject({
      method: "POST",
      url: `/v1/build/tasks/${task2}/result`,
      payload: buildResultPayload(task2, "done"),
    });
    assert.equal(resDone.statusCode, 200);

    // Attempt to change terminal status -> 409 STATUS_CONFLICT
    const resAgain = await app.inject({
      method: "POST",
      url: `/v1/build/tasks/${task2}/result`,
      payload: buildResultPayload(task2, "partial"),
    });
    assert.equal(resAgain.statusCode, 409);

    const body = resAgain.json() as any;
    assert.equal(body?.error?.code, "STATUS_CONFLICT");
  } finally {
    await app.close();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
