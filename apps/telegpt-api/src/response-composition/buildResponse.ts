import type {
  BuildResponseInput,
  ComposedResponse,
  ResponseCompositionPlan,
} from "./types.js";
import { determineResponseStructure } from "./structureComposer.js";
import { determineDepth } from "./brevityController.js";
import { planResponseSegments } from "./segmentPlanner.js";

function normalizeFinalText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function buildComposedResponse(
  input: BuildResponseInput,
): ComposedResponse {
  const structure = determineResponseStructure(
    input.attention_plan,
    input.relationship_plan,
  );
  const depth = determineDepth(input.attention_plan);

  const segments = planResponseSegments({
    structure,
    depth,
    attention_plan: input.attention_plan,
    relationship_plan: input.relationship_plan,
    presence_plan: input.presence_plan,
    intent_plan: input.intent_plan,
    mode_plan: input.mode_plan,
  });

  const plan: ResponseCompositionPlan = {
    structure_type: structure,
    depth,
    segments,
  };

  const text = normalizeFinalText(plan.segments.join(" "));

  return {
    text,
    structure: plan.structure_type,
    depth: plan.depth,
  };
}
