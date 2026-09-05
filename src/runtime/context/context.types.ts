import type { RuntimeIntent, RuntimeRiskLevel } from "../intent/intent.types.js";
import type { ActionRouteKind } from "../routing/action-route.types.js";
import type { RuntimeSurface } from "../input/runtime-input.types.js";

export type ContextLayerName =
  | "user"
  | "project"
  | "canon"
  | "run"
  | "evidence"
  | "capability"
  | "surface"
  | "temporary";

export interface ContextBlock {
  source: ContextLayerName;
  entries: ContextEntry[];
  priority: number;
  token_count: number;
}

export interface ContextEntry {
  id: string;
  key: string;
  value: string;
  source: ContextLayerName;
  priority: number;
  token_count: number;
}

export interface RuntimeContext {
  context_id: string;
  input_id: string;
  run_id?: string;
  user_id: string;

  layers: Partial<Record<ContextLayerName, ContextBlock>>;

  budget: {
    max_tokens: number;
    used_tokens: number;
    truncated: boolean;
  };

  created_at: string;
}

export interface ContextBuildParams {
  content: string;
  user_id: string;
  surface: RuntimeSurface;
  intent: RuntimeIntent;
  risk_level: RuntimeRiskLevel;
  route: ActionRouteKind;
  input_id: string;
}
