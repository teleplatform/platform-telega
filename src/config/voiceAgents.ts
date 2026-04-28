export type AgentVoiceConfig = {
  speaker: string;
  preset: "t800" | "mila" | "kozy" | (string & {});
};

export const AGENT_VOICE_MAP: Record<string, AgentVoiceConfig> = {
  t800: { speaker: "t800_v1", preset: "t800" },
  mila: { speaker: "mila_v1_1", preset: "mila" },
  kozy: { speaker: "kozy", preset: "kozy" },
};

export function getAgentVoiceConfig(assistantId?: string | null): AgentVoiceConfig | null {
  if (!assistantId) return null;
  return AGENT_VOICE_MAP[assistantId] ?? null;
}
