import type { AttentionPlan } from "./types.js";

function extractFocusFromText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length > 0) {
    return trimmed.substring(0, 120);
  }
  return "general_inquiry";
}

export function buildAttentionPlan(input: {
  context_pack: any;
  raw_input: { text: string };
}): AttentionPlan {
  const text = input.raw_input?.text ?? "";
  const lowerText = text.toLowerCase();

  let leadWith = "";
  if (lowerText.includes("поддержк") || lowerText.includes("спокойн") || lowerText.includes("тяжело")) {
    leadWith = "clarify_first";
  } else if (lowerText.includes("дальше") || lowerText.includes("следующ") || lowerText.includes("что делать")) {
    leadWith = "next_correct_step";
  } else if (lowerText.includes("не понял") || lowerText.includes("не совсем понял") || lowerText.includes("уточн")) {
    leadWith = "clarify_first";
  } else {
    leadWith = "next_correct_step";
  }

  const branching = leadWith === "clarify_first" ? "low" : "medium";
  const depth = leadWith === "clarify_first" ? "low" : "medium";

  return {
    primary_focus: extractFocusFromText(text),
    response_shape: {
      lead_with: leadWith,
      branching,
      depth,
    },
  };
}
