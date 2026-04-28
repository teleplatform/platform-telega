// ─────────────────────────────────────────────────────────────
// FORGE BRIDGE HARDENING v1.0 — Review State Builder
// ─────────────────────────────────────────────────────────────

import type { ForgeBundleReviewState } from "./types.js";

export function buildInitialReviewState(): ForgeBundleReviewState {
  return {
    reviewStatus: "not_reviewed",
  };
}

export function buildReviewedState(input?: {
  reviewSummary?: string;
  reviewNotes?: string[];
}): ForgeBundleReviewState {
  return {
    reviewStatus: "reviewed",
    reviewSummary: input?.reviewSummary,
    reviewNotes: input?.reviewNotes,
  };
}

export function buildApprovedState(input?: {
  reviewSummary?: string;
  reviewNotes?: string[];
}): ForgeBundleReviewState {
  return {
    reviewStatus: "approved",
    reviewSummary: input?.reviewSummary,
    reviewNotes: input?.reviewNotes,
  };
}

export function buildBlockedReviewState(input?: {
  reviewSummary?: string;
  reviewNotes?: string[];
}): ForgeBundleReviewState {
  return {
    reviewStatus: "blocked",
    reviewSummary: input?.reviewSummary,
    reviewNotes: input?.reviewNotes,
  };
}
