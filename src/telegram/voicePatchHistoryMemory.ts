/**
 * Voice Patch History & Adaptation Memory v1.6
 *
 * Bounded in-memory store of patch outcome history.
 * Accumulates confirmed / rolled_back / inconclusive outcomes
 * to provide aggregated summary of which patch types are reliable or risky.
 *
 * This layer:
 *   - records patch outcome events
 *   - maintains bounded history (max 100 entries)
 *   - computes aggregated summary (confirmation rate, rollback rate)
 *   - identifies reliable and risky patch types
 *   - provides human-readable summary
 *
 * This layer does NOT:
 *   - use DB or persistence
 *   - use ML or external dependencies
 *   - mutate runtime config
 *   - change existing apply / verification logic
 *   - auto-recommend based on memory
 */

// ============================================================================
// Domain model
// ============================================================================

export type VoicePatchOutcome =
  | "confirmed"
  | "rolled_back"
  | "inconclusive";

export interface VoicePatchHistoryEntry {
  patchId: string;
  rollbackId?: string;

  recommendationType?: string;

  outcome: VoicePatchOutcome;
  reason: string;
  confidence: "low" | "medium" | "high";

  appliedAtMs?: number;
  finalizedAtMs: number;

  beforeMetrics: {
    voiceSuccessRate: number;
    fallbackRate: number;
    interruptionBlockRate: number;
    avgQualityScore: number;
  };

  afterMetrics: {
    voiceSuccessRate: number;
    fallbackRate: number;
    interruptionBlockRate: number;
    avgQualityScore: number;
  };
}

export interface VoicePatchHistorySummary {
  totalEntries: number;

  confirmedCount: number;
  rolledBackCount: number;
  inconclusiveCount: number;

  confirmationRate: number;
  rollbackRate: number;
  inconclusiveRate: number;

  mostReliablePatchTypes: string[];
  mostRiskyPatchTypes: string[];

  generatedAtMs: number;
}

// ============================================================================
// Bounded in-memory store
// ============================================================================

const patchHistory: VoicePatchHistoryEntry[] = [];
const MAX_PATCH_HISTORY = 100;

/**
 * Record a patch outcome in history.
 * Bounded: evicts oldest entries when exceeding limit.
 */
export function rememberVoicePatchHistory(entry: VoicePatchHistoryEntry): void {
  patchHistory.push(entry);

  // Evict oldest if exceeding limit
  if (patchHistory.length > MAX_PATCH_HISTORY) {
    patchHistory.splice(0, patchHistory.length - MAX_PATCH_HISTORY);
  }
}

/**
 * Get recent patch history entries.
 * Returns most recent entries first (reverse chronological).
 */
export function getRecentVoicePatchHistory(limit: number = 10): VoicePatchHistoryEntry[] {
  return patchHistory.slice(-limit).reverse();
}

/**
 * Reset all patch history (testing/cleanup only).
 */
export function resetVoicePatchHistory(): void {
  patchHistory.length = 0;
}

/**
 * Get current entry count (for observability/testing).
 */
export function getVoicePatchHistoryCount(): number {
  return patchHistory.length;
}

// ============================================================================
// Summary aggregation
// ============================================================================

interface PatchTypeStats {
  recommendationType: string;
  confirmedCount: number;
  rolledBackCount: number;
  totalCount: number;
}

/**
 * Compute aggregated summary of patch history.
 * Pure function — deterministic, bounded.
 */
export function getVoicePatchHistorySummary(): VoicePatchHistorySummary {
  const total = patchHistory.length;

  if (total === 0) {
    return {
      totalEntries: 0,
      confirmedCount: 0,
      rolledBackCount: 0,
      inconclusiveCount: 0,
      confirmationRate: 0,
      rollbackRate: 0,
      inconclusiveRate: 0,
      mostReliablePatchTypes: [],
      mostRiskyPatchTypes: [],
      generatedAtMs: Date.now(),
    };
  }

  const confirmedCount = patchHistory.filter((e) => e.outcome === "confirmed").length;
  const rolledBackCount = patchHistory.filter((e) => e.outcome === "rolled_back").length;
  const inconclusiveCount = patchHistory.filter((e) => e.outcome === "inconclusive").length;

  const confirmationRate = Math.round((confirmedCount / total) * 100);
  const rollbackRate = Math.round((rolledBackCount / total) * 100);
  const inconclusiveRate = Math.round((inconclusiveCount / total) * 100);

  // Aggregate by recommendationType
  const typeStats = aggregatePatchTypeStats();

  // Most reliable: at least 2 entries, confirmed > rolled_back
  const mostReliablePatchTypes = computeMostReliablePatchTypes(typeStats);

  // Most risky: at least 2 entries, rolled_back >= confirmed
  const mostRiskyPatchTypes = computeMostRiskyPatchTypes(typeStats);

  return {
    totalEntries: total,
    confirmedCount,
    rolledBackCount,
    inconclusiveCount,
    confirmationRate,
    rollbackRate,
    inconclusiveRate,
    mostReliablePatchTypes,
    mostRiskyPatchTypes,
    generatedAtMs: Date.now(),
  };
}

/**
 * Aggregate stats by recommendationType.
 */
function aggregatePatchTypeStats(): PatchTypeStats[] {
  const typeMap = new Map<string, PatchTypeStats>();

  for (const entry of patchHistory) {
    const recType = entry.recommendationType ?? "unknown";

    if (!typeMap.has(recType)) {
      typeMap.set(recType, {
        recommendationType: recType,
        confirmedCount: 0,
        rolledBackCount: 0,
        totalCount: 0,
      });
    }

    const stats = typeMap.get(recType)!;
    stats.totalCount++;

    if (entry.outcome === "confirmed") {
      stats.confirmedCount++;
    } else if (entry.outcome === "rolled_back") {
      stats.rolledBackCount++;
    }
  }

  return Array.from(typeMap.values());
}

/**
 * Compute most reliable patch types.
 * Criteria: at least 2 entries, confirmed > rolled_back.
 * Sorted by: confirmation dominance → confirmed count → alphabetical.
 * Max 3 types.
 */
function computeMostReliablePatchTypes(stats: PatchTypeStats[]): string[] {
  const reliable = stats.filter(
    (s) => s.totalCount >= 2 && s.confirmedCount > s.rolledBackCount,
  );

  // Sort by confirmation dominance (confirmed - rolled_back), then by confirmed count, then alphabetically
  reliable.sort((a, b) => {
    const dominanceA = a.confirmedCount - a.rolledBackCount;
    const dominanceB = b.confirmedCount - b.rolledBackCount;

    if (dominanceB !== dominanceA) return dominanceB - dominanceA;
    if (b.confirmedCount !== a.confirmedCount) return b.confirmedCount - a.confirmedCount;
    return a.recommendationType.localeCompare(b.recommendationType);
  });

  return reliable.slice(0, 3).map((s) => s.recommendationType);
}

/**
 * Compute most risky patch types.
 * Criteria: at least 2 entries, rolled_back >= confirmed.
 * Sorted by: rollback dominance → rolled_back count → alphabetical.
 * Max 3 types.
 */
function computeMostRiskyPatchTypes(stats: PatchTypeStats[]): string[] {
  const risky = stats.filter(
    (s) => s.totalCount >= 2 && s.rolledBackCount >= s.confirmedCount,
  );

  // Sort by rollback dominance (rolled_back - confirmed), then by rolled_back count, then alphabetically
  risky.sort((a, b) => {
    const dominanceA = a.rolledBackCount - a.confirmedCount;
    const dominanceB = b.rolledBackCount - b.confirmedCount;

    if (dominanceB !== dominanceA) return dominanceB - dominanceA;
    if (b.rolledBackCount !== a.rolledBackCount) return b.rolledBackCount - a.rolledBackCount;
    return a.recommendationType.localeCompare(b.recommendationType);
  });

  return risky.slice(0, 3).map((s) => s.recommendationType);
}

// ============================================================================
// Formatter for human reading
// ============================================================================

/**
 * Format a patch history summary for operator review.
 */
export function formatVoicePatchHistorySummary(summary: VoicePatchHistorySummary): string {
  const lines = [
    `🧠 Voice Patch History Summary`,
    `• total entries: ${summary.totalEntries}`,
    `• confirmed: ${summary.confirmedCount}`,
    `• rolled back: ${summary.rolledBackCount}`,
    `• inconclusive: ${summary.inconclusiveCount}`,
    `• confirmation rate: ${summary.confirmationRate}%`,
    `• rollback rate: ${summary.rollbackRate}%`,
    `• inconclusive rate: ${summary.inconclusiveRate}%`,
  ];

  if (summary.mostReliablePatchTypes.length > 0) {
    lines.push(`• reliable patch types: ${summary.mostReliablePatchTypes.join(", ")}`);
  } else {
    lines.push(`• reliable patch types: (none yet)`);
  }

  if (summary.mostRiskyPatchTypes.length > 0) {
    lines.push(`• risky patch types: ${summary.mostRiskyPatchTypes.join(", ")}`);
  } else {
    lines.push(`• risky patch types: (none yet)`);
  }

  return lines.join("\n");
}
