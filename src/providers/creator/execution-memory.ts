import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const MEMORY_DIR = path.join(process.cwd(), "data", "creator-bridge");
const MEMORY_FILE = path.join(MEMORY_DIR, "memory.jsonl");
const MAX_MEMORY_RECORDS = 1000;
const SIMILARITY_THRESHOLD = 0.9;

export interface MemoryRecord {
  memory_id: string;
  task_hash: string;
  intent: "research" | "write" | "code" | "general";
  strategy_mode: "single" | "multi_agent" | "debate" | "research";
  providers_used: string[];
  result_summary: string;
  success: boolean;
  latency_ms: number;
  created_at: number;
  task_preview: string;
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(MEMORY_DIR, { recursive: true });
  } catch {}
}

async function appendMemory(record: MemoryRecord): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(record) + "\n";
    await fs.appendFile(MEMORY_FILE, line, "utf-8");
  } catch (e) {
    console.error("[memory] write failed", e);
  }
}

async function loadMemory(limit = MAX_MEMORY_RECORDS): Promise<MemoryRecord[]> {
  const records: MemoryRecord[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(MEMORY_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const recent = lines.slice(-limit);
    for (const line of recent) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.memory_id && parsed.task_hash) {
          records.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return records;
}

function computeTaskHash(message: string): string {
  const normalized = message.toLowerCase().replace(/[^\w\s]/g, "").trim().slice(0, 200);
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

function computeIntent(message: string): MemoryRecord["intent"] {
  const m = message.toLowerCase();
  if (m.includes("research") || m.includes("latest") || m.includes("news") || m.includes("source") || m.includes("найди") || m.includes("новост")) {
    return "research";
  }
  if (m.includes("write") || m.includes("document") || m.includes("текст") || m.includes("перепиши") || m.includes("резюме")) {
    return "write";
  }
  if (m.includes("code") || m.includes("logic") || m.includes("analyze") || m.includes("compare")) {
    return "code";
  }
  return "general";
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
}

function jaccardSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(tokenize(text1));
  const tokens2 = new Set(tokenize(text2));
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
}

function getPreview(message: string): string {
  return message.replace(/[^\w\s.,!?]/g, "").trim().slice(0, 200);
}

export async function retrieveSimilarTasks(message: string, limit = 3): Promise<{
  records: MemoryRecord[];
  maxSimilarity: number;
  fastPathUsed: boolean;
  reusedStrategy?: {
    mode: string;
    providers: string[];
  };
}> {
  const memory = await loadMemory();
  if (memory.length === 0) {
    return { records: [], maxSimilarity: 0, fastPathUsed: false };
  }
  
  const taskHash = computeTaskHash(message);
  const taskMemory = memory.find(m => m.task_hash === taskHash);
  
  const scores = memory
    .filter(m => m.task_hash !== taskHash && m.success)
    .map(m => ({
      record: m,
      similarity: jaccardSimilarity(message, m.task_preview),
    }))
    .filter(s => s.similarity > 0.1)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
  
  const maxSimilarity = taskMemory ? 1 : (scores[0]?.similarity || 0);
  
  console.log("[memory] retrieved", {
    exact: !!taskMemory,
    similar: scores.length,
    maxSimilarity,
  });
  
  if (taskMemory && taskMemory.success) {
    return {
      records: [taskMemory],
      maxSimilarity: 1,
      fastPathUsed: true,
      reusedStrategy: {
        mode: taskMemory.strategy_mode,
        providers: taskMemory.providers_used,
      },
    };
  }
  
  if (maxSimilarity >= SIMILARITY_THRESHOLD && scores[0]) {
    return {
      records: scores.map(s => s.record),
      maxSimilarity,
      fastPathUsed: true,
      reusedStrategy: {
        mode: scores[0].record.strategy_mode,
        providers: scores[0].record.providers_used,
      },
    };
  }
  
  return {
    records: scores.map(s => s.record),
    maxSimilarity,
    fastPathUsed: false,
  };
}

export async function writeMemory(
  message: string,
  mode: MemoryRecord["strategy_mode"],
  providers: string[],
  resultText: string,
  success: boolean,
  latencyMs: number
): Promise<void> {
  if (!success || resultText.length < 10) {
    console.log("[memory] skipping - not successful or empty");
    return;
  }
  
  const taskHash = computeTaskHash(message);
  const intent = computeIntent(message);
  const preview = getPreview(message);
  
  const record: MemoryRecord = {
    memory_id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    task_hash: taskHash,
    intent,
    strategy_mode: mode,
    providers_used: providers,
    result_summary: resultText.slice(0, 300),
    success,
    latency_ms: latencyMs,
    created_at: Date.now(),
    task_preview: preview,
  };
  
  await appendMemory(record);
  console.log("[memory] written", { task_hash: taskHash, success, latency: latencyMs });
}

export async function formatMemorySummary(): Promise<string> {
  const memory = await loadMemory();
  const successCount = memory.filter(m => m.success).length;
  const recent = memory.slice(0, 10);
  
  const lines = [
    `🧠 Execution Memory`,
    `${memory.length} records, ${successCount} successful`,
  ];
  
  if (recent.length > 0) {
    lines.push("\nRecent:");
    for (const r of recent) {
      const status = r.success ? "✅" : "❌";
      lines.push(`${status} ${r.strategy_mode}: ${r.providers_used.join("→")} (${r.latency_ms}ms)`);
    }
  }
  
  return lines.join("\n");
}

export async function findMemory(query: string): Promise<string> {
  const memory = await loadMemory();
  const scores = memory
    .map(m => ({
      record: m,
      similarity: jaccardSimilarity(query, m.task_preview),
    }))
    .filter(s => s.similarity > 0.1)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
  
  if (scores.length === 0) {
    return "No similar tasks found";
  }
  
  const lines = ["🔍 Similar tasks:"];
  for (const s of scores) {
    const r = s.record;
    lines.push(`\n� Similarity: ${Math.round(s.similarity * 100)}%`);
    lines.push(`Mode: ${r.strategy_mode}, Providers: ${r.providers_used.join(" → ")}`);
    lines.push(`Summary: ${r.result_summary.slice(0, 150)}`);
  }
  
  return lines.join("\n");
}