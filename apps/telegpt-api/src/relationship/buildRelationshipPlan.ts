import type { RelationshipPlan } from "../arisha-orchestration/types.js";

export function buildRelationshipPlan(input: {
  raw_input: { text: string };
  actor_role: string;
  channel: string;
  context_pack: any;
}): RelationshipPlan {
  const text = input.raw_input?.text ?? "";
  const lowerText = text.toLowerCase();

  if (
    lowerText.includes("поддержк") ||
    lowerText.includes("спокойн") ||
    lowerText.includes("тяжело") ||
    lowerText.includes("страшно")
  ) {
    return { relationship_state: "sensitive_support_mode" };
  }

  return { relationship_state: "neutral" };
}
