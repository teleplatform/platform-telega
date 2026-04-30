import type { SurfaceChannel } from "../surface-adaptation/types.js";
import type {
  DeliveryMode,
  PayloadShape,
  FallbackStrategy,
  DeliveryPolicyPlan,
} from "./types.js";

export function selectDeliveryPolicy(
  surface: SurfaceChannel,
): DeliveryPolicyPlan {
  // Default policy
  let delivery_mode: DeliveryMode = "text_first";
  let payload_shape: PayloadShape = "text_first";
  let voice_enabled = false;
  let fallback_strategy: FallbackStrategy = "no_voice_needed";
  let rationale = "default_text_policy";

  if (surface === "web") {
    delivery_mode = "text_first";
    payload_shape = "text_first";
    voice_enabled = false;
    fallback_strategy = "no_voice_needed";
    rationale = "web_prefers_text";
  } else if (surface === "telegram") {
    delivery_mode = "text_with_optional_voice";
    payload_shape = "text_first";
    voice_enabled = true;
    fallback_strategy = "text_only_on_voice_failure";
    rationale = "telegram_prefers_text_with_optional_voice";
  } else if (surface === "alice") {
    delivery_mode = "voice_first";
    payload_shape = "voice_first";
    voice_enabled = true;
    fallback_strategy = "fallback_required";
    rationale = "alice_prefers_voice_first";
  } else {
    // Any other voice-like surface (e.g. "voice")
    delivery_mode = "text_first";
    payload_shape = "text_first";
    voice_enabled = true;
    fallback_strategy = "keep_text_first";
    rationale = "voice_surface_prefers_text_first_with_voice";
  }

  return {
    delivery_mode,
    payload_shape,
    voice_enabled,
    fallback_strategy,
    rationale,
  };
}
