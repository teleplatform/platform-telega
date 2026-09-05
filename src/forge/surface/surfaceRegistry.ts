import { Surface, SurfaceType, SurfaceStatus, SurfaceCapability, SurfaceRoute } from "./surfaceTypes";

const surfaces = new Map<string, Surface>();

let counter = 0;
function genId(): string {
  counter++;
  return `surf_${Date.now()}_${counter}`;
}

function register(
  name: string,
  type: SurfaceType,
  description: string,
  capabilities: SurfaceCapability[],
  routes: SurfaceRoute[],
  metadata: Record<string, unknown>
): Surface {
  const surface: Surface = {
    surfaceId: genId(),
    name,
    type,
    description,
    status: "active",
    capabilities,
    routes,
    metadata,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  surfaces.set(surface.surfaceId, surface);
  return surface;
}

export const SurfaceRegistry = {
  register,
  get(id: string): Surface | undefined { return surfaces.get(id); },
  getAll(): Surface[] { return Array.from(surfaces.values()); },
  update(id: string, updates: Partial<Surface>): Surface | null {
    const existing = surfaces.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, surfaceId: id, updatedAt: Date.now() };
    surfaces.set(id, updated);
    return updated;
  },
  delete(id: string): boolean { return surfaces.delete(id); },
  listByType(type: SurfaceType): Surface[] {
    return Array.from(surfaces.values()).filter((s) => s.type === type);
  },
  listByStatus(status: SurfaceStatus): Surface[] {
    return Array.from(surfaces.values()).filter((s) => s.status === status);
  },
  listByCapability(capability: string): Surface[] {
    return Array.from(surfaces.values()).filter((s) =>
      s.capabilities.some((c) => c.name.toLowerCase().includes(capability.toLowerCase()))
    );
  },
  size(): number { return surfaces.size; },
};

export function seedKnownSurfaces(): void {
  const known: Array<{ name: string; type: SurfaceType; description: string; capabilities: SurfaceCapability[]; routes: SurfaceRoute[]; metadata: Record<string, unknown> }> = [
    {
      name: "Telegram Bot", type: "telegram",
      description: "Telegram messaging surface with commands, keyboards, and inline UI",
      capabilities: [
        { name: "messaging", description: "Send and receive messages" },
        { name: "commands", description: "Slash commands" },
        { name: "keyboards", description: "Inline and reply keyboards" },
        { name: "voice", description: "Voice message support" },
      ],
      routes: [
        { path: "/api/telegram/webhook", method: "POST", description: "Telegram webhook" },
      ],
      metadata: { framework: "telegraf", polling: true },
    },
    {
      name: "Web App", type: "web",
      description: "Web-based chat interface",
      capabilities: [
        { name: "messaging", description: "Web chat" },
        { name: "files", description: "File upload/download" },
      ],
      routes: [],
      metadata: { framework: "react" },
    },
    {
      name: "Sigma Forge", type: "forge",
      description: "Engineering execution runtime with IDE, DAP, LSP, and patch engine",
      capabilities: [
        { name: "lsp", description: "Language server protocol" },
        { name: "dap", description: "Debug adapter protocol" },
        { name: "patch", description: "Hash-verified patching" },
        { name: "execution", description: "Job graph execution" },
        { name: "repair", description: "Autonomous repair" },
      ],
      routes: [
        { path: "/api/forge/lsp", method: "POST", description: "LSP operations" },
        { path: "/api/forge/dap", method: "POST", description: "DAP operations" },
        { path: "/api/forge/job", method: "POST", description: "Job graph" },
      ],
      metadata: { version: "2.0" },
    },
    {
      name: "Mission Control", type: "mission_control",
      description: "Governance and oversight dashboard for missions, policies, and outcomes",
      capabilities: [
        { name: "missions", description: "Mission management" },
        { name: "policies", description: "Policy engine" },
        { name: "outcomes", description: "Outcome registry" },
        { name: "override", description: "Human override" },
      ],
      routes: [
        { path: "/api/forge/missions", method: "GET", description: "List missions" },
        { path: "/api/forge/policies", method: "GET", description: "List policies" },
      ],
      metadata: { version: "1.0" },
    },
    {
      name: "Voice Runtime", type: "voice",
      description: "Voice input/output via microphone, STT, LLM, TTS",
      capabilities: [
        { name: "stt", description: "Speech to text" },
        { name: "tts", description: "Text to speech" },
        { name: "voice_io", description: "Full voice loop" },
      ],
      routes: [],
      metadata: { stt: "faster-whisper", tts: "macos-say" },
    },
  ];

  for (const s of known) {
    register(s.name, s.type, s.description, s.capabilities, s.routes, s.metadata);
  }
}
