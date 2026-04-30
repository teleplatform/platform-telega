import type { ResponseQualityGateInput, ResponseQualityGateResult } from "./types.js";
import { runFocusGuard } from "./focusGuard.js";
import { runToneGuard } from "./toneGuard.js";
import { runVerbosityGuard } from "./verbosityGuard.js";
import { runValueGuard } from "./valueGuard.js";

function normalizeFinalText(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "";
  }

  return /[.!?…]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function buildFallbackText(input: ResponseQualityGateInput): string {
  if (
    input.relationship_plan.relationship_state === "sensitive_support_mode"
  ) {
    return normalizeFinalText(
      input.presence_plan.chunks[0]?.text ??
        `${input.presence_plan.micro_ack} Можно спокойно пойти шаг за шагом.`,
    );
  }

  if (input.composed_response.structure === "single_line_ack") {
    return normalizeFinalText(
      `${input.presence_plan.micro_ack} Уточни, что именно нужно раскрыть первым.`,
    );
  }

  if (input.composed_response.structure === "next_step_forward") {
    return normalizeFinalText(
      `${input.presence_plan.micro_ack} Следующий правильный шаг — держаться главной линии: ${input.attention_plan.primary_focus}.`,
    );
  }

  return normalizeFinalText(
    `${input.presence_plan.micro_ack} Суть сейчас в этом: ${input.attention_plan.primary_focus}.`,
  );
}

export function runQualityGate(
  input: ResponseQualityGateInput,
): ResponseQualityGateResult {
  const focus = runFocusGuard({
    composed_response: input.composed_response,
    attention_plan: input.attention_plan,
  });

  const tone = runToneGuard({
    composed_response: input.composed_response,
    relationship_plan: input.relationship_plan,
    presence_plan: input.presence_plan,
  });

  const verbosity = runVerbosityGuard({
    composed_response: input.composed_response,
  });

  const revisedComposedResponse = {
    ...input.composed_response,
    text: verbosity.revised_text,
  };

  const value = runValueGuard({
    composed_response: revisedComposedResponse,
  });

  const passedCount = [focus.ok, tone.ok, verbosity.ok, value.ok].filter(Boolean)
    .length;
  const score = passedCount / 4;

  const hardFailure = !tone.ok || !value.ok;
  const finalText = hardFailure
    ? buildFallbackText(input)
    : normalizeFinalText(verbosity.revised_text);

  return {
    status: hardFailure ? "soft_fail" : "pass",
    score,
    final_text: finalText,
    focus,
    tone,
    verbosity,
    value,
  };
}
