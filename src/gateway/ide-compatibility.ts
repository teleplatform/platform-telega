export interface IdeCompatibility {
  modelId: string;
  chatCapable: boolean;
  streamingCapable: boolean;
  toolCallingCapable: boolean;
  multiTurnToolCapable: boolean;
  codingCapable: boolean;
  agentCapable: boolean;
  ideVerified: boolean;
  verifiedAt?: string;
  notes?: string;
}

const IDE_REGISTRY: IdeCompatibility[] = [
  {
    modelId: "kimi-k3",
    chatCapable: true,
    streamingCapable: true,
    toolCallingCapable: true,
    multiTurnToolCapable: true,
    codingCapable: true,
    agentCapable: false,
    ideVerified: false,
    notes: "Phase A: needs IDE smoke verification",
  },
  {
    modelId: "kimi-k2.7-code",
    chatCapable: true,
    streamingCapable: true,
    toolCallingCapable: false,
    multiTurnToolCapable: false,
    codingCapable: true,
    agentCapable: false,
    ideVerified: false,
    notes: "Phase A: needs IDE smoke verification",
  },
  {
    modelId: "zyloo/kimi-k3",
    chatCapable: true,
    streamingCapable: true,
    toolCallingCapable: true,
    multiTurnToolCapable: true,
    codingCapable: true,
    agentCapable: false,
    ideVerified: false,
    notes: "Zyloo upstream Kimi K3 — needs IDE smoke verification",
  },
];

const BY_MODEL = new Map<string, IdeCompatibility>(
  IDE_REGISTRY.map((e) => [e.modelId, e])
);

export function getIdeCompatibility(modelId: string): IdeCompatibility | undefined {
  return BY_MODEL.get(modelId);
}

export function isIdeReady(modelId: string, experimental?: boolean): boolean {
  const entry = BY_MODEL.get(modelId);
  if (!entry) return false;
  if (entry.ideVerified) return true;
  if (experimental) return entry.chatCapable;
  return false;
}

export function listIdeModels(experimental?: boolean): IdeCompatibility[] {
  if (experimental) return IDE_REGISTRY.filter((e) => e.chatCapable);
  return IDE_REGISTRY.filter((e) => e.ideVerified);
}

export function markIdeVerified(modelId: string): void {
  const entry = BY_MODEL.get(modelId);
  if (entry) {
    entry.ideVerified = true;
    entry.verifiedAt = new Date().toISOString();
  }
}
