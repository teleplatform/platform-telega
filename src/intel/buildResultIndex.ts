// @ts-nocheck
import fs from "fs";
import path from "path";

export type BuildResultIndexEntryV1 = {
  kind: "PANTHEON_BUILD_RESULT_INDEX_ENTRY_V1";
  id: string;
  task_id: string;
  trace_id?: string;
  created_at: string;
  status: "done" | "failed";
  pack: string;
  artifacts: Array<{ type: string; path: string; note?: string }>;
  error?: { message: string };
};

type BuildResultIndexV1 = {
  schema: "PANTHEON_BUILD_RESULT_INDEX_V1";
  updated_at: string;
  items: BuildResultIndexEntryV1[];
};

function indexPath(telegaRoot: string) {
  return path.join(telegaRoot, "mission-control", "buildtasks", "results_index.json");
}

function readIndex(telegaRoot: string): BuildResultIndexV1 {
  const p = indexPath(telegaRoot);
  if (!fs.existsSync(p)) {
    return {
      schema: "PANTHEON_BUILD_RESULT_INDEX_V1",
      updated_at: new Date().toISOString(),
      items: [],
    };
  }
  try {
    const raw = fs.readFileSync(p, "utf8");
    const json = JSON.parse(raw);
    if (json?.schema !== "PANTHEON_BUILD_RESULT_INDEX_V1" || !Array.isArray(json?.items)) {
      return {
        schema: "PANTHEON_BUILD_RESULT_INDEX_V1",
        updated_at: new Date().toISOString(),
        items: [],
      };
    }
    return json as BuildResultIndexV1;
  } catch {
    return {
      schema: "PANTHEON_BUILD_RESULT_INDEX_V1",
      updated_at: new Date().toISOString(),
      items: [],
    };
  }
}

function writeIndex(telegaRoot: string, data: BuildResultIndexV1) {
  const p = indexPath(telegaRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

export function appendBuildResultIndex(
  telegaRoot: string,
  entry: Omit<BuildResultIndexEntryV1, "kind">
) {
  const idx = readIndex(telegaRoot);
  const items = idx.items.filter((x) => x?.id !== entry.id);
  items.unshift({ kind: "PANTHEON_BUILD_RESULT_INDEX_ENTRY_V1", ...entry });
  const next: BuildResultIndexV1 = {
    schema: "PANTHEON_BUILD_RESULT_INDEX_V1",
    updated_at: new Date().toISOString(),
    items: items.slice(0, 200),
  };
  writeIndex(telegaRoot, next);
  return next;
}

export function listBuildResultsFromIndex(telegaRoot: string, take = 10, offset = 0) {
  const idx = readIndex(telegaRoot);
  const off = Math.max(0, offset | 0);
  const t = Math.max(1, take | 0);
  return idx.items.slice(off, off + t);
}

export function getBuildResultsCount(telegaRoot: string) {
  const idx = readIndex(telegaRoot);
  return idx.items.length;
}

export function findBuildResultsByPack(telegaRoot: string, q: string, take = 10) {
  const idx = readIndex(telegaRoot);
  const needle = String(q || "").trim().toLowerCase();
  if (!needle) return [];
  return idx.items
    .filter((it) => String(it.pack || "").toLowerCase().includes(needle))
    .slice(0, Math.max(1, take | 0));
}

export function findTaskIdByTrace(telegaRoot: string, traceId: string): string | null {
  const idx = readIndex(telegaRoot);
  const hit = idx.items.find((r) => r.trace_id === traceId);
  return hit?.task_id || null;
}
