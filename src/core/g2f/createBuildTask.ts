import { db } from "../db.ts";

export async function createBuildTask(args: {
  kind: "forge.build";
  title: string;
  prompt: string;
  artifacts_expected?: string[];
  source?: Record<string, any> | null;
}) {
  const payload = {
    kind: args.kind,
    title: args.title,
    prompt: args.prompt,
    artifacts_expected: args.artifacts_expected ?? [],
    source: args.source ?? null,
  };

  const task = db.tasks.create({
    title: args.title,
    visibility: "core",
    task_json: JSON.stringify(payload),
  });

  return { id: task.id, payload };
}
