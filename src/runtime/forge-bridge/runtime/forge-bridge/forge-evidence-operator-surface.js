// ─────────────────────────────────────────────────────────────
// FORGE EVIDENCE OPERATOR SURFACE v1
//
// Owner-only surface for evidence retrieval.
// Capability-gated access to evidence views.
// ─────────────────────────────────────────────────────────────
import { getRuntimeRole } from "../../core/auth/runtime-access.js";
import { buildRecentEvidenceView, buildFailedEvidenceView, buildBlockedEvidenceView, buildInvocationDetailView, buildEvidenceStatsView, } from "./forge-evidence-views.js";
import { formatRecentEvidenceList, formatFailedEvidenceList, formatBlockedEvidenceList, formatEvidenceDetail, formatEvidenceStats, formatEmptyEvidence, formatEvidenceNotFound, } from "./forge-evidence-telegram.js";
function isOwnerOrPartner(userId) {
    const role = getRuntimeRole(userId);
    return role.startsWith("owner_") || role.startsWith("partner_");
}
export function canAccessEvidence(userId) {
    return isOwnerOrPartner(userId);
}
export async function handleEvidenceOperatorAction(userId, action) {
    if (!canAccessEvidence(userId)) {
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
    }
    catch (e) {
        return {
            ok: false,
            text: `⚠️ Ошибк��: ${e.message}`,
            error: "internal_error",
        };
    }
}
