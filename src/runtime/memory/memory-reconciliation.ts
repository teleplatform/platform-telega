import { getMemory, setMemory, deleteMemory } from "./runtime-memory-store.js";
import { getFact } from "../identity/runtime-facts.js";

interface MemoryConflict {
  memoryKey: string;
  storedValue: unknown;
  userClaim: string;
  resolvedBy: "truth" | "user" | "timeout";
  resolvedAt: number;
}

const MAX_CONFLICTS = 50;
let conflictLog: MemoryConflict[] = [];

export function reconcileMemory(
  memoryKey: string,
  userClaim: string,
  userValue: unknown,
): { accepted: boolean; resolvedValue: unknown; reason: string } {
  const factKey = memoryKey.replace("user_claimed.", "");
  const runtimeFact = getFact(factKey);

  if (runtimeFact && runtimeFact.verified) {
    conflictLog.push({
      memoryKey,
      storedValue: userValue,
      userClaim,
      resolvedBy: "truth",
      resolvedAt: Date.now(),
    });
    if (conflictLog.length > MAX_CONFLICTS) conflictLog.shift();
    return {
      accepted: false,
      resolvedValue: runtimeFact.value,
      reason: `rejected: runtime fact ${factKey}=${runtimeFact.value} overrides user claim`,
    };
  }

  const stored = getMemory(memoryKey);
  if (!stored) {
    setMemory(memoryKey, userValue, "user_provided", false);
    return { accepted: true, resolvedValue: userValue, reason: "new_memory_created" };
  }

  conflictLog.push({
    memoryKey,
    storedValue: stored.value,
    userClaim,
    resolvedBy: "user",
    resolvedAt: Date.now(),
  });
  if (conflictLog.length > MAX_CONFLICTS) conflictLog.shift();
  setMemory(memoryKey, userValue, stored.category, false);
  return {
    accepted: true,
    resolvedValue: userValue,
    reason: "accepted: no verified runtime fact contradicts this claim",
  };
}

export function getConflictLog(): MemoryConflict[] {
  return [...conflictLog];
}

export function clearConflicts(): void {
  conflictLog = [];
}
