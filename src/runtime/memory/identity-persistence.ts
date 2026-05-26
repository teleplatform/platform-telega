import { loadStore, getMemory, setMemory, getAllMemories } from "./runtime-memory-store.js";
import { initializeFacts, getFacts } from "../identity/runtime-facts.js";
import { getFullSystemPrompt } from "../identity/runtime-identity.js";

const IDENTITY_MEMORY_KEY = "runtime.identity.state";

interface IdentityState {
  initializedAt: number;
  lastRestoreAt: number;
  restoreCount: number;
  identityPrompt: string;
}

export function initializeIdentityMemory(): void {
  loadStore();
  initializeFacts();

  const state = getMemory(IDENTITY_MEMORY_KEY);
  if (state) {
    const s = state.value as IdentityState;
    s.lastRestoreAt = Date.now();
    s.restoreCount++;
    setMemory(IDENTITY_MEMORY_KEY, s, "identity", true);
    console.log("[identity-persistence] restored identity state:", {
      initializedAt: new Date(s.initializedAt).toISOString(),
      restoreCount: s.restoreCount,
    });
  } else {
    const s: IdentityState = {
      initializedAt: Date.now(),
      lastRestoreAt: Date.now(),
      restoreCount: 0,
      identityPrompt: getFullSystemPrompt(),
    };
    setMemory(IDENTITY_MEMORY_KEY, s, "identity", true);
    console.log("[identity-persistence] initialized fresh identity state");
  }
}

export function getIdentityState(): IdentityState | null {
  const mem = getMemory(IDENTITY_MEMORY_KEY);
  return (mem?.value as IdentityState) || null;
}

export function getContinuitySummary(): string {
  const state = getIdentityState();
  const facts = getFacts();
  const memories = getAllMemories();

  const lines: string[] = [
    "=== IDENTITY CONTINUITY ===",
  ];

  if (state) {
    lines.push(`Initialized: ${new Date(state.initializedAt).toISOString()}`);
    lines.push(`Last restore: ${new Date(state.lastRestoreAt).toISOString()}`);
    lines.push(`Restore count: ${state.restoreCount}`);
  }

  lines.push("");
  lines.push("=== VERIFIED FACTS ===");
  facts.filter(f => f.verified).forEach(f => lines.push(`- ${f.key}: ${f.value}`));

  lines.push("");
  lines.push("=== PERSISTED MEMORIES ===");
  const categories = new Set(memories.map(m => m.category));
  for (const cat of categories) {
    const count = memories.filter(m => m.category === cat).length;
    lines.push(`- ${cat}: ${count} entries`);
  }

  return lines.join("\n");
}

export function isIdentityContinuityMaintained(): boolean {
  const state = getIdentityState();
  if (!state) return false;
  return state.restoreCount >= 1 && state.initializedAt > 0;
}
