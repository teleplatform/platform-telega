import type { MemoryLayer } from "../../fsgr-contracts/src/index.js";

export const ALL_MEMORY_LAYERS: MemoryLayer[] = ["bootstrap", "operator", "workspace", "run", "canon", "evidence"];

const LAYER_PRIORITY: Record<MemoryLayer, number> = {
  bootstrap: 0,
  operator: 1,
  workspace: 2,
  run: 3,
  canon: 4,
  evidence: 5,
};

export function isValidMemoryLayer(layer: string): layer is MemoryLayer {
  return ALL_MEMORY_LAYERS.includes(layer as MemoryLayer);
}

export function getLayerPriority(layer: MemoryLayer): number {
  return LAYER_PRIORITY[layer] ?? -1;
}
