import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const MEMORY_DIR = path.join(DATA_DIR, "memory");
const TEKTITE_FILE = path.join(MEMORY_DIR, "tektite.jsonl");
const OBLIVION_FILE = path.join(MEMORY_DIR, "oblivion.jsonl");

interface TektiteEntry {
  id: string;
  type: "canon" | "knowledge" | "reference" | "document";
  title: string;
  content: string;
  tags: string[];
  source?: string;
  created_at: number;
}

interface OblivionEntry {
  id: string;
  type: "action" | "error" | "decision" | "workflow" | "insight";
  event: string;
  details: string;
  outcome: "success" | "failure" | "partial";
  context?: Record<string, any>;
  created_at: number;
}

interface MemoryIndex {
  type: string;
  key: string;
  value: string;
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

async function logEvidence(event: string, data: object): Promise<void> {
  await ensureDir(MEMORY_DIR);
  const file = path.join(MEMORY_DIR, "memory-audit.jsonl");
  const line = JSON.stringify({ event, ...data, timestamp: Date.now() });
  await fs.appendFile(file, line + "\n");
}

export async function tektiteSave(
  title: string,
  content: string,
  type: TektiteEntry["type"] = "knowledge",
  tags: string[] = [],
  source?: string
): Promise<TektiteEntry> {
  const entry: TektiteEntry = {
    id: `tektite_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    type,
    title,
    content,
    tags,
    source,
    created_at: Date.now(),
  };

  await ensureDir(MEMORY_DIR);
  await fs.appendFile(TEKTITE_FILE, JSON.stringify(entry) + "\n");

  await logEvidence("tektite_saved", { id: entry.id, type, title });
  console.log("[memory] Tektite saved:", entry.id);

  return entry;
}

export async function tektiteFind(query: string, limit: number = 5): Promise<TektiteEntry[]> {
  await ensureDir(MEMORY_DIR);
  
  try {
    const content = await fs.readFile(TEKTITE_FILE, "utf-8");
    const entries = content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    
    const results = entries.filter((e: TektiteEntry) => 
      e.title.toLowerCase().includes(query.toLowerCase()) ||
      e.content.toLowerCase().includes(query.toLowerCase()) ||
      e.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
    );

    await logEvidence("tektite_found", { query, count: results.length });
    return results.slice(0, limit);
  } catch {
    return [];
  }
}

export async function tektiteList(type?: string, limit: number = 10): Promise<TektiteEntry[]> {
  await ensureDir(MEMORY_DIR);
  
  try {
    const content = await fs.readFile(TEKTITE_FILE, "utf-8");
    let entries = content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    
    if (type) {
      entries = entries.filter((e: TektiteEntry) => e.type === type);
    }
    
    return entries.reverse().slice(0, limit);
  } catch {
    return [];
  }
}

export async function oblivionRemember(
  event: string,
  details: string,
  type: OblivionEntry["type"] = "action",
  outcome: OblivionEntry["outcome"] = "success",
  context?: Record<string, any>
): Promise<OblivionEntry> {
  const entry: OblivionEntry = {
    id: `oblivion_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    type,
    event,
    details,
    outcome,
    context,
    created_at: Date.now(),
  };

  await ensureDir(MEMORY_DIR);
  await fs.appendFile(OBLIVION_FILE, JSON.stringify(entry) + "\n");

  await logEvidence("oblivion_remembered", { id: entry.id, type, event });
  console.log("[memory] Oblivion remembered:", entry.id);

  return entry;
}

export async function oblivionFind(query: string, limit: number = 10): Promise<OblivionEntry[]> {
  await ensureDir(MEMORY_DIR);
  
  try {
    const content = await fs.readFile(OBLIVION_FILE, "utf-8");
    const entries = content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    
    const results = entries.filter((e: OblivionEntry) => 
      e.event.toLowerCase().includes(query.toLowerCase()) ||
      e.details.toLowerCase().includes(query.toLowerCase())
    );

    await logEvidence("oblivion_found", { query, count: results.length });
    return results.reverse().slice(0, limit);
  } catch {
    return [];
  }
}

export async function oblivionByOutcome(outcome: OblivionEntry["outcome"], limit: number = 10): Promise<OblivionEntry[]> {
  await ensureDir(MEMORY_DIR);
  
  try {
    const content = await fs.readFile(OBLIVION_FILE, "utf-8");
    const entries = content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
    
    return entries.filter((e: OblivionEntry) => e.outcome === outcome).reverse().slice(0, limit);
  } catch {
    return [];
  }
}

export async function memorySave(
  text: string,
  layer: "tektite" | "oblivion",
  type?: string
): Promise<{ id: string }> {
  if (layer === "tektite") {
    const entry = await tektiteSave(text.substring(0, 50), text, type as any);
    return { id: entry.id };
  } else {
    const entry = await oblivionRemember(text, text, type as any);
    return { id: entry.id };
  }
}

export async function memoryFind(query: string, limit: number = 5): Promise<{
  tektite: TektiteEntry[];
  oblivion: OblivionEntry[];
}> {
  const tektite = await tektiteFind(query, limit);
  const oblivion = await oblivionFind(query, limit);
  
  return { tektite, oblivion };
}

export async function getMemoryStatus(): Promise<{
  tektite_count: number;
  oblivion_count: number;
  last_tektite?: number;
  last_oblivion?: number;
}> {
  await ensureDir(MEMORY_DIR);
  
  let tektiteCount = 0, oblivionCount = 0;
  let lastTektite: number | undefined, lastOblivion: number | undefined;
  
  try {
    const tektiteContent = await fs.readFile(TEKTITE_FILE, "utf-8");
    tektiteCount = tektiteContent.trim().split("\n").filter(Boolean).length;
    if (tektiteCount > 0) {
      const lines = tektiteContent.trim().split("\n");
      lastTektite = JSON.parse(lines[lines.length - 1]).created_at;
    }
  } catch {}
  
  try {
    const oblivionContent = await fs.readFile(OBLIVION_FILE, "utf-8");
    oblivionCount = oblivionContent.trim().split("\n").filter(Boolean).length;
    if (oblivionCount > 0) {
      const lines = oblivionContent.trim().split("\n");
      lastOblivion = JSON.parse(lines[lines.length - 1]).created_at;
    }
  } catch {}

  return {
    tektite_count: tektiteCount,
    oblivion_count: oblivionCount,
    last_tektite: lastTektite,
    last_oblivion: lastOblivion,
  };
}

export async function memoryForget(layer: string, id: string): Promise<boolean> {
  await logEvidence("memory_forgotten", { layer, id });
  console.log("[memory] Forget request:", layer, id);
  return true;
}