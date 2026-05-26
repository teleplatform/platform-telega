import type { BrowserStepResult, BrowserTaskResult } from "./browser-types.js";

export type BrowserEffectKind =
  | "navigation"      // url changed
  | "interaction"     // click, type
  | "data_collection" // extract, screenshot
  | "state_change"    // page state changed (click, type, navigate)
  | "error"           // action failed
  | "mixed";          // multiple effects

export interface StepEffect {
  stepLabel: string;
  effect: BrowserEffectKind;
  detail: string;
  impact: "read" | "write" | "observe";
}

export function classifyStepEffect(step: BrowserStepResult): StepEffect {
  if (step.error) {
    return { stepLabel: step.label, effect: "error", detail: step.error, impact: "observe" };
  }

  if (step.actionResult.url || step.actionResult.title) {
    if (step.actionResult.elementFound !== undefined) {
      return { stepLabel: step.label, effect: "interaction", detail: `element ${step.actionResult.elementFound ? "found" : "not found"}`, impact: "write" };
    }
    if (step.actionResult.screenshotPath) {
      return { stepLabel: step.label, effect: "data_collection", detail: `screenshot: ${step.actionResult.screenshotPath}`, impact: "read" };
    }
    if (step.actionResult.text) {
      return { stepLabel: step.label, effect: "data_collection", detail: `extracted ${step.actionResult.text.length} chars`, impact: "read" };
    }
    return { stepLabel: step.label, effect: "navigation", detail: `url: ${step.actionResult.url}`, impact: "read" };
  }

  return { stepLabel: step.label, effect: "observation", detail: "page accessed", impact: "observe" };
}

export function classifyTaskEffect(result: BrowserTaskResult): {
  primary: BrowserEffectKind;
  effects: StepEffect[];
  impactSummary: string;
} {
  const effects = result.stepResults.map(classifyStepEffect);

  const hasError = effects.some(e => e.effect === "error");
  const hasInteraction = effects.some(e => e.effect === "interaction");
  const hasNavigation = effects.some(e => e.effect === "navigation");
  const hasDataCollection = effects.some(e => e.effect === "data_collection");

  let primary: BrowserEffectKind;
  if (hasError && effects.length === 1) primary = "error";
  else if (hasNavigation && hasInteraction) primary = "state_change";
  else if (hasInteraction) primary = "interaction";
  else if (hasNavigation) primary = "navigation";
  else if (hasDataCollection) primary = "data_collection";
  else primary = "mixed";

  const readCount = effects.filter(e => e.impact === "read").length;
  const writeCount = effects.filter(e => e.impact === "write").length;
  const observeCount = effects.filter(e => e.impact === "observe").length;

  const impactSummary = `read:${readCount} write:${writeCount} observe:${observeCount}`;

  return { primary, effects, impactSummary };
}
