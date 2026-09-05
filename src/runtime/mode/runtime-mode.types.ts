import type { RuntimeAccessMode } from "../provider/provider.types.js";

export type { RuntimeAccessMode } from "../provider/provider.types.js";

export interface RuntimeModeResolution {
  runtime_mode: RuntimeAccessMode;
  reason: string;
  confidence: number;
  evidence_required: boolean;
}

export interface RuntimeModeConfig {
  creator_telegram_id: string;
  creator_user_id?: string;
}
