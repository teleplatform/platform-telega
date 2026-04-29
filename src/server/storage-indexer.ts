import fs from "fs/promises";
import path from "path";

const DATA_BASE = path.join(process.cwd(), "data");
const INDEXES_DIR = path.join(DATA_BASE, "indexes");

export interface FileIndex {
  file: string;
  line_count: number;
  size_bytes: number;
  last_updated: number;
  index_count: number;
  corrupt_lines: number;
}

export interface IndexEntry {
  id: string;
  line_number: number;
  timestamp?: number;
  status?: string;
  user_id?: string;
  [key: string]: any;
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

export async function buildIndex(
  sourceFile: string,
  indexFields: string[]
): Promise<{ index: IndexEntry[]; stats: { total: number; corrupt: number } }> {
  const entries: IndexEntry[] = [];
  let total = 0;
  let corrupt = 0;

  try {
    const content = await fs.readFile(sourceFile, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    total = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const parsed = safeParse(lines[i]);
      if (!parsed) {
        corrupt++;
        continue;
      }

      const entry: IndexEntry = {
        id: (parsed.id ?? parsed.workflow_id ?? parsed.request_id ?? parsed.action_id ?? parsed.task_id ?? parsed.job_id ?? "") + "",
        line_number: i + 1,
      };

      for (const field of indexFields) {
        if (parsed[field] !== undefined) {
          entry[field] = parsed[field];
        }
      }

      entries.push(entry);
    }
  } catch (e) {
    console.error("[storage-index] error building index for", sourceFile, e);
  }

  return { index: entries, stats: { total, corrupt } };
}

export async function saveIndex(
  indexName: string,
  index: IndexEntry[]
): Promise<void> {
  await ensureDir(INDEXES_DIR);
  await fs.writeFile(
    path.join(INDEXES_DIR, `${indexName}.json`),
    JSON.stringify(index, null, 2)
  );
}

export async function readIndex(indexName: string): Promise<IndexEntry[]> {
  try {
    const content = await fs.readFile(
      path.join(INDEXES_DIR, `${indexName}.json`),
      "utf-8"
    );
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export async function getStorageStats(): Promise<{
  files: FileIndex[];
  indexes: string[];
}> {
  const subdirs = ["forge", "telegram", "evidence", "audit"];
  const files: FileIndex[] = [];
  let indexes: string[] = [];

  try {
    await ensureDir(INDEXES_DIR);
    const indexFiles = await fs.readdir(INDEXES_DIR);
    indexes = indexFiles.map((f) => f.replace(".json", ""));
  } catch {}

  for (const subdir of subdirs) {
    const dir = path.join(DATA_BASE, subdir);
    try {
      const dirFiles = await fs.readdir(dir);
      for (const file of dirFiles) {
        if (!file.endsWith(".jsonl")) continue;

        const filePath = path.join(dir, file);
        try {
          const stat = await fs.stat(filePath);
          const content = await fs.readFile(filePath, "utf-8");
          const lines = content.trim().split("\n").filter(Boolean);
          const validLines = lines.filter((l) => safeParse(l));

          files.push({
            file: `${subdir}/${file}`,
            line_count: validLines.length,
            size_bytes: stat.size,
            last_updated: stat.mtimeMs,
            index_count: 0,
            corrupt_lines: lines.length - validLines.length,
          });
        } catch {}
      }
    } catch {}
  }

  return { files, indexes };
}

export async function rebuildAllIndexes(): Promise<{
  rebuilt: string[];
  errors: string[];
}> {
  const rebuilt: string[] = [];
  const errors: string[] = [];

  const indexConfigs = [
    { source: "forge/workflows.jsonl", index: "forge-workflows", fields: ["workflow_id", "current_stage", "status", "user_id"] },
    { source: "forge/tasks.jsonl", index: "forge-tasks", fields: ["task_id", "status", "user_id"] },
    { source: "forge/timelines.jsonl", index: "forge-timelines", fields: ["timeline_id", "workflow_id", "event"] },
    { source: "forge/task-graph.jsonl", index: "forge-task-graph", fields: ["graph_id", "workflow_id"] },
    { source: "forge/checkpoints.jsonl", index: "forge-checkpoints", fields: ["checkpoint_id", "workflow_id"] },
    { source: "forge/heal-plans.jsonl", index: "forge-heal-plans", fields: ["plan_id", "workflow_id", "status"] },
    { source: "forge/auto-modes.jsonl", index: "forge-auto-modes", fields: ["record_id", "workflow_id", "status"] },
    { source: "telegram/kilo-patches/index.jsonl", index: "kilo-patches", fields: ["plan_id", "status", "user_id"] },
    { source: "telegram/kilo-execution.jsonl", index: "kilo-execution", fields: ["exec_id", "status", "user_id"] },
    { source: "telegram/mcp-audit.jsonl", index: "mcp-audit", fields: ["audit_id", "action", "user_id"] },
  ];

  for (const config of indexConfigs) {
    try {
      const sourcePath = path.join(DATA_BASE, config.source);
      const { index, stats } = await buildIndex(sourcePath, config.fields);

      await saveIndex(config.index, index);

      console.log("[storage-index] rebuilt", config.index, {
        entries: index.length,
        corrupt: stats.corrupt,
      });

      rebuilt.push(config.index);
    } catch (e: any) {
      console.error("[storage-index] error", config.index, e?.message);
      errors.push(config.index);
    }
  }

  return { rebuilt, errors };
}

export async function validateStorage(): Promise<{
  valid_dirs: string[];
  invalid_dirs: string[];
  total_files: number;
  total_corrupt: number;
}> {
  const subdirs = ["forge", "telegram", "evidence", "audit"];
  const valid_dirs: string[] = [];
  const invalid_dirs: string[] = [];
  let total_files = 0;
  let total_corrupt = 0;

  for (const subdir of subdirs) {
    const dir = path.join(DATA_BASE, subdir);
    try {
      await fs.access(dir);

      const dirFiles = await fs.readdir(dir);
      let hasJsonl = false;
      let corrupt = 0;

      for (const file of dirFiles) {
        if (!file.endsWith(".jsonl")) continue;
        hasJsonl = true;

        const content = await fs.readFile(path.join(dir, file), "utf-8");
        const lines = content.trim().split("\n").filter(Boolean);
        total_files += lines.length;

        for (const line of lines) {
          if (!safeParse(line)) corrupt++;
        }
        total_corrupt += corrupt;
      }

      valid_dirs.push(subdir);
    } catch {
      invalid_dirs.push(subdir);
    }
  }

  return { valid_dirs, invalid_dirs, total_files, total_corrupt };
}