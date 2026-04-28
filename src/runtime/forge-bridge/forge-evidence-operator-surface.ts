// ─────────────────────────────────────────────────────────────
// FORGE EVIDENCE OPERATOR SURFACE v1
//
// Owner-only surface for evidence retrieval.
// Capability-gated access to evidence views.
// ─────────────────────────────────────────────────────────────

import {
  buildRecentEvidenceView,
  buildFailedEvidenceView,
  buildBlockedEvidenceView,
  buildInvocationDetailView,
  buildEvidenceStatsView,
} from "./forge-evidence-views.js";
import {
  formatRecentEvidenceList,
  formatFailedEvidenceList,
  formatBlockedEvidenceList,
  formatEvidenceDetail,
  formatEvidenceStats,
  formatEmptyEvidence,
  formatEvidenceNotFound,
} from "./forge-evidence-telegram.js";

export type ForgeEvidenceOperatorAction =
  | { type: "recent"; limit?: number }
  | { type: "failed"; limit?: number }
  | { type: "blocked"; limit?: number }
  | { type: "detail"; invocationId: string }
  | { type: "stats" };

export interface ForgeEvidenceOperatorResult {
  ok: boolean;
  text: string;
  error?: string;
}

// Simple role check for evidence access - only owners can access evidence
export function canAccessEvidence(role: string): boolean {
  return role.startsWith("owner_");
}

export async function handleEvidenceOperatorAction(
  userId: string,
  role: string,
  action: ForgeEvidenceOperatorAction,
): Promise<ForgeEvidenceOperatorResult> {
  if (!canAccessEvidence(role)) {
    return {
      ok: false,
      text: "⛔ Доступ к Sigma Forge Evidence только для создателей.",
      error: "access_denied",
    };
  }

  try {
    switch (action.type) {
      case "recent": {
        const limit = action.limit || 10;
        const view = await buildRecentEvidenceView(limit);
        return {
          ok: true,
          text: view.length > 0
            ? formatRecentEvidenceList(view)
            : formatEmptyEvidence(),
        };
      }

      case "failed": {
        const limit = action.limit || 10;
        const view = await buildFailedEvidenceView(limit);
        return {
          ok: true,
          text: view.length > 0
            ? formatFailedEvidenceList(view)
            : "✅ Нет Failed вызовов.",
        };
      }

      case "blocked": {
        const limit = action.limit || 10;
        const view = await buildBlockedEvidenceView(limit);
        return {
          ok: true,
          text: view.length > 0
            ? formatBlockedEvidenceList(view)
            : "✅ Нет Blocked вызовов.",
        };
      }

      case "detail": {
        const view = await buildInvocationDetailView(action.invocationId);
        return {
          ok: true,
          text: view ? formatEvidenceDetail(view) : formatEvidenceNotFound(),
        };
      }

      case "stats": {
        const view = await buildEvidenceStatsView();
        return {
          ok: true,
          text: formatEvidenceStats(view),
        };
      }

      default:
        return {
          ok: false,
          text: "❓ Неизвестное действие.",
          error: "unknown_action",
        };
    }
  } catch (e: any) {
    return {
      ok: false,
      text: `⚠️ Ошибка: ${e.message}`,
      error: "internal_error",
    };
  }
}