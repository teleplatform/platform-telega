/**
 * Maps abstract voice identity IDs to provider-native voice parameters.
 *
 * Voice identities (female_warm, male_pro, …) are UI concepts — each TTS engine
 * expects its own voice names (OpenAI: nova/onyx, Yandex: alena/filipp, …).
 */

import type { VoiceProviderId } from "./voice-provider.types.js";
import type { VoiceIdentity } from "../../telegram/state/telegram-voice-identity.js";

const OPENAI_VOICES: Record<string, string> = {
  male_pro: "onyx",
  male_warm: "echo",
  male_deep: "onyx",
  female_pro: "nova",
  female_warm: "shimmer",
  female_soft: "nova",
};

const YANDEX_VOICES: Record<string, string> = {
  male_pro: "filipp",
  male_warm: "ermil",
  male_deep: "zahar",
  female_pro: "alena",
  female_warm: "jane",
  female_soft: "omazh",
};

const SILERO_SPEAKERS: Record<string, string> = {
  male_pro: "aidar",
  male_warm: "eugene",
  male_deep: "aidar",
  female_pro: "baya",
  female_warm: "kseniya",
  female_soft: "xenia",
};

export function resolveProviderVoiceParam(
  provider: VoiceProviderId,
  identity: VoiceIdentity,
  language = "ru",
): string | undefined {
  const id = identity.id;

  switch (provider) {
    case "openai_tts":
      return OPENAI_VOICES[id] ?? (language === "ru" ? "onyx" : "alloy");
    case "yandex_speechkit_tts":
      return YANDEX_VOICES[id] ?? (language === "en" ? "john" : "alena");
    case "silero_tts":
      return SILERO_SPEAKERS[id] ?? "aidar";
    case "supertone_tts":
      return language === "en" ? "en_US" : "ru_RU";
    case "xtts_tts":
      return "default";
    default:
      return undefined;
  }
}
