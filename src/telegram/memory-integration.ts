import { tektiteFind, oblivionFind, oblivionByOutcome, getMemoryStatus } from "./memory-stack.js";

interface MemoryContext {
  tektite: any[];
  oblivion: any[];
  relevance_scores: Record<string, number>;
}

interface FusionContext {
  user_input: string;
  knowledge: any[];
  experience: any[];
  memory_used: boolean;
  timestamp: number;
}

const DEFAULT_CONTEXT_WINDOW = 5000;

export async function injectTektiteKnowledge(query: string, limit: number = 3): Promise<any[]> {
  const results = await tektiteFind(query, limit);
  
  for (const r of results) {
    await logEvidence("memory_injected_tektite", { query, id: r.id, title: r.title });
  }
  
  return results;
}

export async function injectOblivionExperience(query: string, limit: number = 3): Promise<any[]> {
  const results = await oblivionFind(query, limit);
  
  for (const r of results) {
    await logEvidence("memory_injected_oblivion", { query, id: r.id, event: r.event });
  }
  
  return results;
}

export async function injectSuccessPatterns(context: string, limit: number = 5): Promise<any[]> {
  const results = await oblivionByOutcome("success", limit);
  const filtered = results.filter((r: any) => 
    r.event.toLowerCase().includes(context.toLowerCase()) ||
    r.details.toLowerCase().includes(context.toLowerCase())
  );
  
  for (const r of filtered) {
    await logEvidence("memory_injected_pattern", { id: r.id, outcome: r.outcome });
  }
  
  return filtered;
}

export async function injectFailurePatterns(context: string, limit: number = 5): Promise<any[]> {
  const results = await oblivionByOutcome("failure", limit);
  const filtered = results.filter((r: any) => 
    r.event.toLowerCase().includes(context.toLowerCase()) ||
    r.details.toLowerCase().includes(context.toLowerCase())
  );
  
  for (const r of filtered) {
    await logEvidence("memory_injected_failure", { id: r.id, outcome: r.outcome });
  }
  
  return filtered;
}

export async function fusionMemoryContext(
  userInput: string,
  options: {
    includeKnowledge?: boolean;
    includeExperience?: boolean;
    includePatterns?: boolean;
    knowledgeLimit?: number;
    experienceLimit?: number;
  } = {}
): Promise<FusionContext> {
  const {
    includeKnowledge = true,
    includeExperience = true,
    includePatterns = true,
    knowledgeLimit = 3,
    experienceLimit = 3,
  } = options;

  const knowledge: any[] = [];
  const experience: any[] = [];
  let memoryUsed = false;

  const keywords = extractKeywords(userInput);

  if (includeKnowledge && keywords.length > 0) {
    for (const kw of keywords.slice(0, 3)) {
      const results = await injectTektiteKnowledge(kw, knowledgeLimit);
      knowledge.push(...results);
    }
    if (knowledge.length > 0) memoryUsed = true;
  }

  if (includeExperience && keywords.length > 0) {
    for (const kw of keywords.slice(0, 3)) {
      const results = await injectOblivionExperience(kw, experienceLimit);
      experience.push(...results);
    }
    if (experience.length > 0) memoryUsed = true;
  }

  if (includePatterns && keywords.length > 0) {
    const successPatterns = await injectSuccessPatterns(keywords[0], 2);
    const failPatterns = await injectFailurePatterns(keywords[0], 2);
    
    experience.push(...successPatterns, ...failPatterns);
    if (successPatterns.length > 0 || failPatterns.length > 0) {
      memoryUsed = true;
    }
  }

  const context: FusionContext = {
    user_input: userInput,
    knowledge: knowledge.slice(0, 5),
    experience: experience.slice(0, 5),
    memory_used: memoryUsed,
    timestamp: Date.now(),
  };

  await logEvidence("fusion_context_created", {
    input_length: userInput.length,
    knowledge_count: knowledge.length,
    experience_count: experience.length,
  });

  return context;
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "shall", "can", "need", "dare", "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by", "from", "up", "about", "into", "over", "after", "beneath", "under", "above", "the", "and", "but", "or", "nor", "so", "yet", "both", "either", "neither", "not", "only", "just", "que", "и", "в", "на", "по", "с", "к", "за", "из", "до", "у", "о", "об", "при", "для"]);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));
  
  return [...new Set(words)].slice(0, 5);
}

export function buildPromptWithMemory(
  basePrompt: string,
  context: FusionContext
): string {
  let enhancedPrompt = basePrompt;

  if (context.knowledge.length > 0) {
    const knowledgeText = context.knowledge
      .map((k) => `📚 ${k.title}: ${k.content.substring(0, 100)}`)
      .join("\n");
    enhancedPrompt += `\n\nKnowledge:\n${knowledgeText}`;
  }

  if (context.experience.length > 0) {
    const experienceText = context.experience
      .map((e) => `💭 ${e.event}: ${e.outcome}`)
      .join("\n");
    enhancedPrompt += `\n\nPast Experience:\n${experienceText}`;
  }

  return enhancedPrompt;
}

async function logEvidence(event: string, data: object): Promise<void> {
  const MEMORY_DIR = path.join(process.cwd(), "data", "memory");
  try {
    await fs.mkdir(MEMORY_DIR, { recursive: true });
  } catch {}
  
  const file = path.join(MEMORY_DIR, "memory-integration.jsonl");
  const line = JSON.stringify({ event, ...data, timestamp: Date.now() });
  await fs.appendFile(file, line + "\n");
}

import path from "path";
import fs from "fs/promises";

export async function autoSaveOrderExperience(
  orderId: string,
  outcome: "success" | "failure",
  details: string
): Promise<void> {
  const { oblivionRemember } = await import("./memory-stack.js");
  await oblivionRemember(
    `order_${outcome}_${orderId}`,
    details,
    "action",
    outcome
  );
  await logEvidence("memory_write_auto", { type: "order", outcome, orderId });
}

export async function autoSaveAdExperience(
  adId: string,
  roi: number,
  outcome: "success" | "failure"
): Promise<void> {
  const { oblivionRemember } = await import("./memory-stack.js");
  const details = `Ad ${adId}: ROI ${roi.toFixed(0)}%`;
  await oblivionRemember(
    `ad_${outcome}_${adId}`,
    details,
    "workflow",
    outcome
  );
  await logEvidence("memory_write_auto", { type: "ad", outcome, roi });
}

export async function autoSavePattern(
  pattern: string,
  type: "action" | "error" | "decision",
  success: boolean
): Promise<void> {
  const { oblivionRemember } = await import("./memory-stack.js");
  await oblivionRemember(
    pattern,
    pattern,
    type,
    success ? "success" : "failure"
  );
  await logEvidence("memory_write_auto", { type: "pattern", pattern_type: type });
}