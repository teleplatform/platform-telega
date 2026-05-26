import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { BrowserTaskResult } from "./browser-types.js";

interface ArtifactEntry {
  id: string;
  kind: "screenshot" | "page_source" | "text_content";
  path: string;
  hash: string;
  size: number;
  taskIntent: string;
  planId: string;
  stepLabel: string;
  registeredAt: number;
}

const registry: Map<string, ArtifactEntry> = new Map();
const REGISTRY_FILE = ".data/runtime/browser/artifact-registry.json";

function loadRegistry(): void {
  const fp = path.join(process.cwd(), REGISTRY_FILE);
  if (!fs.existsSync(fp)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(fp, "utf-8"));
    if (Array.isArray(raw)) {
      registry.clear();
      for (const e of raw) registry.set(e.id, e);
    }
  } catch {}
}

function saveRegistry(): void {
  const fp = path.join(process.cwd(), REGISTRY_FILE);
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(Array.from(registry.values()), null, 2), "utf-8");
}

function fileHash(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
  } catch {
    return "unknown";
  }
}

export function registerArtifact(
  kind: ArtifactEntry["kind"],
  filePath: string,
  taskIntent: string,
  planId: string,
  stepLabel: string,
): ArtifactEntry {
  loadRegistry();
  const hash = fileHash(filePath);
  let size = 0;
  try { size = fs.statSync(filePath).size; } catch {}
  const entry: ArtifactEntry = {
    id: `art_brw_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    kind,
    path: filePath,
    hash,
    size,
    taskIntent,
    planId,
    stepLabel,
    registeredAt: Date.now(),
  };
  registry.set(entry.id, entry);
  saveRegistry();
  return entry;
}

export function registerScreenshots(result: BrowserTaskResult, stepLabel: string): string[] {
  const ids: string[] = [];
  for (const sp of result.screenshotPaths) {
    const entry = registerArtifact("screenshot", sp, result.intent, result.planId, stepLabel);
    ids.push(entry.id);
  }
  return ids;
}

export function getArtifact(id: string): ArtifactEntry | undefined {
  loadRegistry();
  return registry.get(id);
}

export function getArtifactsByPlan(planId: string): ArtifactEntry[] {
  loadRegistry();
  return Array.from(registry.values()).filter(e => e.planId === planId);
}

export function getAllArtifacts(): ArtifactEntry[] {
  loadRegistry();
  return Array.from(registry.values());
}

export function artifactRegistrySummary(): string {
  const all = getAllArtifacts();
  if (all.length === 0) return "No artifacts registered.";
  const byKind = new Map<string, number>();
  for (const a of all) byKind.set(a.kind, (byKind.get(a.kind) || 0) + 1);
  const kindBreakdown = Array.from(byKind.entries()).map(([k, c]) => `${k}: ${c}`).join(", ");
  return `Artifacts: ${all.length} total (${kindBreakdown})`;
}
