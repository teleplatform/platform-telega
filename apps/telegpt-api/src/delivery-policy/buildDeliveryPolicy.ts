export type PayloadShape = "text_first" | "text_only" | "audio_first" | "audio_only";

export interface DeliveryPolicy {
  delivery_mode: string;
  payload_shape: PayloadShape;
  voice_enabled: boolean;
  rationale: string;
}

export function buildDeliveryPolicy(
  surface: string,
  _adaptedText: string,
): DeliveryPolicy {
  if (surface === "voice" || surface === "alice") {
    return {
      delivery_mode: surface,
      payload_shape: "audio_first",
      voice_enabled: true,
      rationale: `surface=${surface} enables voice path`,
    };
  }

  if (surface === "web" || surface === "telegram") {
    return {
      delivery_mode: surface,
      payload_shape: "text_first",
      voice_enabled: false,
      rationale: `surface=${surface} is text-oriented`,
    };
  }

  return {
    delivery_mode: "text",
    payload_shape: "text_first",
    voice_enabled: false,
    rationale: "default text delivery",
  };
}
