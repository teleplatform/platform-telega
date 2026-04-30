import type { MemoryLayer, MemoryRecord } from "../../fsgr-contracts/src/index.js";

export function canWriteMemory(layer: MemoryLayer, sourceKind: string): boolean {
  switch (layer) {
    case "bootstrap":
      return sourceKind === "system";
    case "canon":
      return sourceKind === "system" || sourceKind === "operator";
    case "evidence":
      return sourceKind === "execution" || sourceKind === "review";
    case "run":
      return sourceKind === "execution" || sourceKind === "review" || sourceKind === "artifact";
    case "workspace":
      return sourceKind === "operator" || sourceKind === "execution";
    case "operator":
      return sourceKind === "operator";
    default:
      return false;
  }
}

export function canReadMemory(layer: MemoryLayer, actor_mode?: string): boolean {
  switch (layer) {
    case "bootstrap":
      return true;
    case "canon":
      return true;
    case "run":
      return true;
    case "workspace":
      return actor_mode === "creator" || actor_mode === "internal" || actor_mode === "system";
    case "operator":
      return actor_mode === "internal" || actor_mode === "system";
    case "evidence":
      return actor_mode === "creator" || actor_mode === "internal" || actor_mode === "system";
    default:
      return false;
  }
}

export function classifyMemoryImportance(record: Omit<MemoryRecord, "importance">): "low" | "medium" | "high" {
  if (record.layer === "evidence") return "high";
  if (record.layer === "bootstrap") return "high";
  if (record.tags.includes("review")) return "high";
  if (record.tags.includes("artifact")) return "medium";
  if (record.layer === "run") return "medium";
  return "low";
}
