export type DeliveryMode =
  | "text_only"
  | "text_first"
  | "voice_first"
  | "text_with_optional_voice"
  | "fallback_only";

export type PayloadShape =
  | "text_only"
  | "text_first"
  | "voice_first";

export type FallbackStrategy =
  | "text_only_on_voice_failure"
  | "keep_text_first"
  | "fallback_required"
  | "no_voice_needed";

export interface DeliveryPolicyPlan {
  delivery_mode: DeliveryMode;
  payload_shape: PayloadShape;
  voice_enabled: boolean;
  fallback_strategy: FallbackStrategy;
  rationale: string;
}
