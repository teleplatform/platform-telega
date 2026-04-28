import type { ForgeEvidenceListItem, ForgeEvidenceDetailView, ForgeEvidenceStatsView } from "./forge-evidence-views.js";
export declare function formatRecentEvidenceList(items: ForgeEvidenceListItem[]): string;
export declare function formatFailedEvidenceList(items: ForgeEvidenceListItem[]): string;
export declare function formatBlockedEvidenceList(items: ForgeEvidenceListItem[]): string;
export declare function formatEvidenceDetail(view: ForgeEvidenceDetailView): string;
export declare function formatEvidenceStats(view: ForgeEvidenceStatsView): string;
export declare function formatEmptyEvidence(): string;
export declare function formatEvidenceNotFound(): string;
