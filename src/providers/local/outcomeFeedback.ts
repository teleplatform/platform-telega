import * as fs from "fs";
import * as path from "path";
import { writeLocalProviderEvidence } from"./localEvidence.js";

const OUTCOME_FILE = path.resolve(".data/local-outcomes.json");

interface OutcomeRecord {
  modelId: string;
  modelName: string;
  timestamp: number;
  type: "positive" | "negative" | "retry" | "correction" | "followup";
  userMessage?: string;
  sessionId?: string;
}

interface ModelOutcomeStats {
  modelId: string;
  modelName: string;
  totalOutcomes: number;
  positive: number;
  negative: number;
  retries: number;
  corrections: number;
  followups: number;
  outcomeScore: number;
}

function loadAllOutcomes(): OutcomeRecord[] {
  try {
    const dir = path.dirname(OUTCOME_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(OUTCOME_FILE)) return [];
    const raw = fs.readFileSync(OUTCOME_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAllOutcomes(records: OutcomeRecord[]): void {
  try {
    fs.writeFileSync(OUTCOME_FILE, JSON.stringify(records, null, 2), "utf-8");
  } catch {
    // silent
  }
}

function computeOutcomeScore(stats: ModelOutcomeStats): number {
  if (stats.totalOutcomes === 0) return 50;

  const positiveRate = stats.positive / stats.totalOutcomes;
  const retryRate = stats.totalOutcomes > 0 ? stats.retries / stats.totalOutcomes : 0;
  const correctionRate = stats.totalOutcomes > 0 ? stats.corrections / stats.totalOutcomes : 0;
  const followupRate = stats.totalOutcomes > 0 ? stats.followups / stats.totalOutcomes : 0;

  const baseScore = positiveRate * 100;
  const retryPenalty = retryRate * 30;
  const correctionPenalty = correctionRate * 40;
  const followupPenalty = followupRate * 20;

  const score = Math.max(0, Math.round(baseScore - retryPenalty - correctionPenalty - followupPenalty));
  return score;
}

export function recordOutcome(
  modelId: string,
  modelName: string,
  type: OutcomeRecord["type"],
  userMessage?: string,
  sessionId?: string
): void {
  const records = loadAllOutcomes();
  records.push({ modelId, modelName, timestamp: Date.now(), type, userMessage, sessionId });
  saveAllOutcomes(records);

  // Also write evidence
  const eventMap: Record<string, string> = {
    positive: "local_outcome_positive",
    negative: "local_outcome_negative",
    retry: "local_retry_required",
    correction: "local_user_correction",
    followup: "local_followup_penalty",
  };
  writeLocalProviderEvidence(eventMap[type] as any, modelId, modelName, "ollama", {
    userMessage: userMessage?.slice(0, 100),
    sessionId,
  });
}

export function getModelOutcomes(modelId: string): OutcomeRecord[] {
  return loadAllOutcomes().filter((r) => r.modelId === modelId);
}

export function getAllModelOutcomeStats(): Map<string, ModelOutcomeStats> {
  const records = loadAllOutcomes();
  const grouped = new Map<string, OutcomeRecord[]>();

  for (const r of records) {
    if (!grouped.has(r.modelId)) grouped.set(r.modelId, []);
    grouped.get(r.modelId)!.push(r);
  }

  const stats = new Map<string, ModelOutcomeStats>();
  for (const [modelId, modelRecords] of grouped) {
    const name = modelRecords[0]?.modelName || modelId;
    const positive = modelRecords.filter((r) => r.type === "positive").length;
    const negative = modelRecords.filter((r) => r.type === "negative").length;
    const retries = modelRecords.filter((r) => r.type === "retry").length;
    const corrections = modelRecords.filter((r) => r.type === "correction").length;
    const followups = modelRecords.filter((r) => r.type === "followup").length;
    const total = modelRecords.length;

    stats.set(modelId, {
      modelId,
      modelName: name,
      totalOutcomes: total,
      positive,
      negative,
      retries,
      corrections,
      followups,
      outcomeScore: 0,
    });
  }

  // Compute scores
  for (const [id, s] of stats) {
    s.outcomeScore = computeOutcomeScore(s);
  }

  return stats;
}

export function getOutcomeScoreForModel(modelId: string): number {
  const stats = getAllModelOutcomeStats();
  return stats.get(modelId)?.outcomeScore ?? 50;
}

export function getBestOutcomeModel(): { modelId: string; modelName: string; score: number } | null {
  const stats = getAllModelOutcomeStats();
  let best: { modelId: string; modelName: string; score: number } | null = null;

  for (const [id, s] of stats) {
    if (!best || s.outcomeScore > best.score) {
      best = { modelId: id, modelName: s.modelName, score: s.outcomeScore };
    }
  }

  return best;
}

export const CORRECTION_PATTERNS = [
  /^(нет|не так|неправильно|переделай|исправь|не то|другой|не верно)/i,
  /^исправ/i,
  /^перепиши/i,
  /^не подходит/i,
  /^не то что нужно/i,
  /^это не то/i,
];

export function isUserCorrection(message: string): boolean {
  return CORRECTION_PATTERNS.some((p) => p.test(message.trim()));
}

export function isFollowUp(message: string, conversationLength: number): boolean {
  if (conversationLength < 3) return false;
  // Short follow-up questions in an existing conversation
  const trimmed = message.trim();
  return trimmed.length < 80 && !trimmed.startsWith("/") && conversationLength > 2;
}
