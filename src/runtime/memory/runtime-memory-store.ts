import fs from "node:fs";
import path from "node:path";

const MEMORY_DIR = ".data/runtime/memory";

interface StoredMemory {
  key: string;
  value: unknown;
  category: string;
  timestamp: number;
  verified: boolean;
}

let store: StoredMemory[] = [];
let loaded = false;

function getFilePath(): string {
  return path.join(process.cwd(), MEMORY_DIR, "store.json");
}

function ensureDir(): void {
  const dir = path.join(process.cwd(), MEMORY_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadStore(): void {
  const filePath = getFilePath();
  ensureDir();
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      store = JSON.parse(raw) as StoredMemory[];
    } catch {
      store = [];
    }
  } else {
    store = [];
  }
  loaded = true;
}

export function saveStore(): void {
  const filePath = getFilePath();
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf-8");
}

export function getMemory(key: string): StoredMemory | undefined {
  if (!loaded) loadStore();
  return store.find(m => m.key === key);
}

export function setMemory(key: string, value: unknown, category: string, verified = true): void {
  if (!loaded) loadStore();
  const existing = store.findIndex(m => m.key === key);
  const entry: StoredMemory = { key, value, category, timestamp: Date.now(), verified };
  if (existing >= 0) {
    store[existing] = entry;
  } else {
    store.push(entry);
  }
  saveStore();
}

export function getMemoriesByCategory(category: string): StoredMemory[] {
  if (!loaded) loadStore();
  return store.filter(m => m.category === category);
}

export function getAllMemories(): StoredMemory[] {
  if (!loaded) loadStore();
  return [...store];
}

export function deleteMemory(key: string): void {
  if (!loaded) loadStore();
  store = store.filter(m => m.key !== key);
  saveStore();
}

export function memorySummary(category?: string): string {
  if (!loaded) loadStore();
  const items = category ? store.filter(m => m.category === category) : store;
  return items
    .filter(m => m.verified)
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(m => `- ${m.key}: ${JSON.stringify(m.value)} [${m.category}]`)
    .join("\n");
}
