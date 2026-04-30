import type { ResponseQualityGateResult } from "../response-quality/types.js";

export type SurfaceChannel = "web" | "telegram" | "voice" | "alice";

export interface SurfaceAdaptationInput {
  final_text: string;
  surface: SurfaceChannel;
  quality_result: ResponseQualityGateResult;
}

export interface SurfaceAdaptationOutput {
  surface: SurfaceChannel;
  original_text: string;
  adapted_text: string;
  rationale: string;
}
