export interface RuntimeFact {
  key: string;
  value: string;
  category: "identity" | "hardware" | "provider" | "runtime" | "governance";
  verified: boolean;
}

let facts: RuntimeFact[] = [];

export function initializeFacts(): void {
  facts = [
    { key: "system.name", value: "Tele•GPT Runtime", category: "identity", verified: true },
    { key: "system.type", value: "local sovereign inference runtime", category: "identity", verified: true },
    { key: "system.architecture", value: "constitutional sovereign cognitive civilization kernel", category: "identity", verified: true },
    { key: "hardware.cpu", value: "Intel i7-8750H", category: "hardware", verified: true },
    { key: "hardware.platform", value: "macOS (darwin)", category: "hardware", verified: true },
    { key: "provider.name", value: "Ollama", category: "provider", verified: true },
    { key: "provider.model", value: "qwen2.5:7b-instruct", category: "provider", verified: true },
    { key: "provider.mode", value: "local sovereign inference", category: "provider", verified: true },
    { key: "runtime.role", value: "creator", category: "runtime", verified: true },
    { key: "runtime.governance", value: "active", category: "governance", verified: true },
    { key: "runtime.mode", value: "operational", category: "runtime", verified: true },
  ];
}

export function getFacts(): RuntimeFact[] {
  if (facts.length === 0) initializeFacts();
  return [...facts];
}

export function getFact(key: string): RuntimeFact | undefined {
  return facts.find(f => f.key === key);
}

export function getFactsByCategory(category: RuntimeFact["category"]): RuntimeFact[] {
  return facts.filter(f => f.category === category);
}

export function factSummary(): string {
  return facts
    .filter(f => f.verified)
    .map(f => `${f.key}: ${f.value}`)
    .join("\n");
}
