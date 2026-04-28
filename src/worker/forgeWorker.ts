import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "../core/db.ts";

type ForgePayload = {
  kind?: string;
  title?: string;
  prompt?: string;
  artifacts_expected?: string[];
  source?: Record<string, any> | null;
};

export async function runForgeOnce() {
  const queued = db.tasks.listQueued({ limit: 10 });
  let processed = 0;
  let completed = 0;
  let errors = 0;
  for (const task of queued) {
    const row = db.tasks.get(task.task_id);
    if (!row || row.status !== "queued" || typeof row.version !== "number") continue;

    const startOk = db.tasks.updateCAS({
      id: row.task_id,
      expectedVersion: row.version,
      patch: { status: "running", heartbeat_at: new Date().toISOString() },
    });
    if (!startOk.ok) continue;

    processed++;

    try {
      const payload: ForgePayload = safeJson(row.task_json ?? "{}");
      const artifacts = await generateArtifacts(row.task_id, payload);

      const result = {
        artifacts_count: artifacts.length,
        artifacts,
      };

      db.tasks.setResult({
        id: row.task_id,
        status: "done",
        result_json: JSON.stringify(result),
      });
      completed++;
    } catch {
      errors++;
    }
  }

  return { processed, completed, errors };
}

async function generateArtifacts(taskId: string, payload: ForgePayload) {
  const dir = path.join(process.cwd(), "artifacts", taskId);
  await fs.mkdir(dir, { recursive: true });

  const expected = payload.artifacts_expected?.length
    ? payload.artifacts_expected
    : ["plan.md", "patch.diff", "pack.json"];

  const outputs: Array<{
    id: string;
    name: string;
    path: string;
    bytes: number;
    mime: string;
  }> = [];

  for (const name of expected) {
    const content = artifactContent(name, payload);
    const filePath = path.join(dir, name);
    await fs.writeFile(filePath, content, "utf-8");
    const bytes = Buffer.byteLength(content);
    const mime = name.endsWith(".json")
      ? "application/json"
      : name.endsWith(".md")
        ? "text/markdown"
        : "text/plain";

    const id = crypto.randomUUID();
    db.taskArtifacts.insert({
      id,
      task_id: taskId,
      name,
      mime,
      path: filePath,
      bytes,
      created_at: Date.now(),
    });

    outputs.push({ id, name, path: filePath, bytes, mime });
  }

  return outputs;
}

function artifactContent(name: string, payload: ForgePayload) {
  if (name.endsWith(".json")) {
    return JSON.stringify(
      {
        kind: payload.kind ?? "forge.build",
        title: payload.title ?? "BuildTask",
        prompt: payload.prompt ?? "",
        source: payload.source ?? null,
      },
      null,
      2
    );
  }

  if (name.endsWith(".md")) {
    return [
      `# Forge Build Plan`,
      ``,
      `Title: ${payload.title ?? "BuildTask"}`,
      ``,
      `Prompt:`,
      `${payload.prompt ?? ""}`,
      ``,
      `Artifacts: ${(payload.artifacts_expected ?? []).join(", ")}`,
    ].join("\n");
  }

  return `# Patch draft\n\n${payload.prompt ?? ""}\n`;
}

function safeJson(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}
