import type { VoicePersonaProfile } from "./voice-surface.types.js";

export type VoicePersonaId = string;

export class VoicePersonaRegistry {
  private personas: Map<VoicePersonaId, VoicePersonaProfile> = new Map();

  register(profile: VoicePersonaProfile): void {
    this.personas.set(profile.persona_id, profile);
  }

  get(persona_id: string): VoicePersonaProfile | undefined {
    return this.personas.get(persona_id);
  }

  list(): VoicePersonaProfile[] {
    return Array.from(this.personas.values());
  }

  findByName(name: string): VoicePersonaProfile | undefined {
    return this.list().find(
      (p) => p.display_name.toLowerCase() === name.toLowerCase() || p.persona_id.toLowerCase() === name.toLowerCase(),
    );
  }
}
