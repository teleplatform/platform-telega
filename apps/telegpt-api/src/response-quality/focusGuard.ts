import type { AttentionPlan } from "../arisha-orchestration/types.js";
import type { ComposedResponse } from "../response-composition/types.js";
import type { FocusGuardResult } from "./types.js";

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function extractKeywords(text: string): string[] {
  return normalize(text)
    .split(/[^a-zа-яё0-9]+/iu)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4);
}

export function runFocusGuard(input: {
  composed_response: ComposedResponse;
  attention_plan: AttentionPlan;
}): FocusGuardResult {
  const primaryFocus = input.attention_plan.primary_focus?.trim() ?? "";
  const responseText = normalize(input.composed_response.text);

  if (!primaryFocus) {
    return {
      ok: true,
      reason: "primary_focus_missing_but_not_blocking",
    };
  }

  const keywords = extractKeywords(primaryFocus);

  if (keywords.length === 0) {
    return {
      ok: true,
      reason: "primary_focus_has_no_stable_keywords",
    };
  }

  const hasMatch = keywords.some((keyword) => responseText.includes(keyword));

  if (hasMatch) {
    return {
      ok: true,
      reason: "response_keeps_primary_focus",
    };
  }

  if (input.composed_response.structure === "supportive_elaboration") {
    return {
      ok: true,
      reason: "supportive_elaboration_allowed_without_explicit_focus_repeat",
    };
  }

  return {
    ok: false,
    reason: "response_drifted_from_primary_focus",
  };
}
