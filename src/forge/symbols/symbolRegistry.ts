import { SymbolNode, SymbolKind, SymbolRange } from "./symbolTypes";

const registry = new Map<string, SymbolNode>();

let counter = 0;
function generateId(): string {
  counter++;
  return `sym_${Date.now()}_${counter}`;
}

export const SymbolRegistry = {
  add(node: Omit<SymbolNode, "id" | "updatedAt">): SymbolNode {
    const id = generateId();
    const full: SymbolNode = { ...node, id, updatedAt: Date.now() };
    registry.set(id, full);
    return full;
  },

  get(id: string): SymbolNode | undefined {
    return registry.get(id);
  },

  getByName(name: string): SymbolNode[] {
    return Array.from(registry.values()).filter((s) => s.name === name);
  },

  getByFile(file: string): SymbolNode[] {
    return Array.from(registry.values()).filter((s) => s.file === file);
  },

  update(id: string, updates: Partial<SymbolNode>): SymbolNode | null {
    const existing = registry.get(id);
    if (!existing) return null;
    const updated: SymbolNode = { ...existing, ...updates, id, updatedAt: Date.now() };
    registry.set(id, updated);
    return updated;
  },

  getAll(): SymbolNode[] {
    return Array.from(registry.values());
  },

  search(query: string): SymbolNode[] {
    const q = query.toLowerCase();
    return Array.from(registry.values()).filter(
      (s) => s.name.toLowerCase().includes(q) || s.file.toLowerCase().includes(q)
    );
  },

  delete(id: string): boolean {
    return registry.delete(id);
  },

  clear(): void {
    registry.clear();
  },

  size(): number {
    return registry.size;
  },
};
