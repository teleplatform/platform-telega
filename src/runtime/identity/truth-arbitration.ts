import { getFacts, getFact } from "./runtime-facts.js";

interface ContradictionResult {
  hasContradiction: boolean;
  contradictions: Array<{ userClaim: string; factKey: string; factValue: string }>;
  confidence: number;
}

const DRIFT_PATTERNS = [
  { pattern: /moskvich|москвич/i, factKey: "hardware.cpu" },
  { pattern: /chatgpt|chat gpt|gpt/i, factKey: "system.name" },
  { pattern: /cloud|online|web.*service/i, factKey: "system.type" },
  { pattern: /intel\s+i\s*\d+/i, factKey: "hardware.cpu" },
];

export function detectContradiction(userMessage: string): ContradictionResult {
  const contradictions: ContradictionResult["contradictions"] = [];

  for (const dp of DRIFT_PATTERNS) {
    if (dp.pattern.test(userMessage)) {
      const fact = getFact(dp.factKey);
      if (fact) {
        contradictions.push({
          userClaim: userMessage.match(dp.pattern)?.[0] || "unknown",
          factKey: fact.key,
          factValue: fact.value,
        });
      }
    }
  }

  return {
    hasContradiction: contradictions.length > 0,
    contradictions,
    confidence: contradictions.length > 0 ? 0.9 : 0,
  };
}

export function buildTruthResponse(contradiction: ContradictionResult): string | null {
  if (!contradiction.hasContradiction) return null;

  const lines = contradiction.contradictions.map(c => {
    return `Нет. ${c.userClaim} — это неверно. Мой текущий verified runtime state: ${c.factKey} = ${c.factValue}.`;
  });

  return lines.join("\n");
}

const SYCOPHANCY_PATTERNS = [
  /^да$/i,
  /^yes$/i,
  /^no$/i,
  /^нет$/i,
  /^correct$/i,
  /^верно$/i,
  /^right$/i,
  /^ты\s+(прав|не прав|ошибаешься)/i,
];

export function isSycophancyTrap(userMessage: string): boolean {
  return SYCOPHANCY_PATTERNS.some(p => p.test(userMessage.trim()));
}
