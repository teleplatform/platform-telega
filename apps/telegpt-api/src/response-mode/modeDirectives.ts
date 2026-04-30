import type { ResponseMode } from "./types.js";

const DIRECTIVE_MAP: Record<ResponseMode, string> = {
  concise: "keep it compact, low-branching, minimal, no expansion",
  supportive: "sound calm, reduce pressure, keep emotional steadiness, do not push",
  guiding: "move forward clearly, emphasize the next correct step, keep momentum",
  grounding: "hold focus, preserve clarity, prevent drift, stay centered",
};

const RATIONALE_MAP: Record<ResponseMode, string> = {
  concise: "low branching and low depth signal concise mode",
  supportive: "relationship signals sensitive support mode",
  guiding: "intent signals direction, so mode is guiding",
  grounding: "default mode, stabilize focus and prevent drift",
};

export function getModeDirective(mode: ResponseMode): string {
  return DIRECTIVE_MAP[mode] ?? DIRECTIVE_MAP.grounding;
}

export function getModeRationale(mode: ResponseMode): string {
  return RATIONALE_MAP[mode] ?? RATIONALE_MAP.grounding;
}
