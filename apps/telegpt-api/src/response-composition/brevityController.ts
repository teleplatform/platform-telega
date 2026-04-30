import type { AttentionPlan } from "../arisha-orchestration/types.js";
import type { ResponseDepth } from "./types.js";

export function determineDepth(attention: AttentionPlan): ResponseDepth {
  if (
    attention.response_shape.branching === "low" &&
    attention.response_shape.depth === "low"
  ) {
    return "brief";
  }

  if (attention.response_shape.depth === "medium_high") {
    return "deep";
  }

  return "medium";
}
