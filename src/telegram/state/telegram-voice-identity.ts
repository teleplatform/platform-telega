/**
 * TGR-6.40 — Voice Identity Layer
 *
 * Defines "how the assistant sounds" — separate from persona (what it says).
 * Each voice identity maps to a TTS engine + voice parameter.
 *
 *   Persona      = What is said
 *   Voice Identity = How it sounds
 */

export interface VoiceIdentity {
  id: string;
  label: string;
  description: string;
  /** TTS engine hint passed as `voice` param to TTSInput */
  ttsVoiceParam: string;
}

const IDENTITIES: VoiceIdentity[] = [
  { id: "male_pro",     label: "👨 Male Pro",       description: "Уверенный мужской голос",       ttsVoiceParam: "male_pro" },
  { id: "male_warm",    label: "👨 Male Warm",      description: "Мягкий мужской голос",          ttsVoiceParam: "male_warm" },
  { id: "male_deep",    label: "👨 Male Deep",      description: "Глубокий мужской голос",        ttsVoiceParam: "male_deep" },
  { id: "female_pro",   label: "👩 Female Pro",     description: "Уверенный женский голос",       ttsVoiceParam: "female_pro" },
  { id: "female_warm",  label: "👩 Female Warm",    description: "Мягкий женский голос",          ttsVoiceParam: "female_warm" },
  { id: "female_soft",  label: "👩 Female Soft",    description: "Нежный женский голос",          ttsVoiceParam: "female_soft" },
];

const userVoiceIdentities = new Map<string, string>();

export function getVoiceIdentities(): VoiceIdentity[] {
  return IDENTITIES;
}

export function getVoiceIdentity(id: string): VoiceIdentity | undefined {
  return IDENTITIES.find(i => i.id === id);
}

export function setUserVoiceIdentity(userId: string, identityId: string): void {
  userVoiceIdentities.set(userId, identityId);
}

export function getUserVoiceIdentity(userId: string): VoiceIdentity {
  const id = userVoiceIdentities.get(userId) ?? getDefaultVoiceIdentityId();
  return getVoiceIdentity(id) ?? IDENTITIES[0];
}

export function getDefaultVoiceIdentityId(): string {
  return "female_warm";
}
