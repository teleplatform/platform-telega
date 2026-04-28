export type CreatorProvider = "ollama_local" | "openai_api" | "creator_bridge";
export type CreatorBridgeModel = "openai" | "qwen" | "deepseek";

type CreatorSessionState = {
  provider: CreatorProvider;
  consent_token?: string;
  bridge_enabled: boolean;
  bridge_model: CreatorBridgeModel;
};

const creatorSessions = new Map<string, CreatorSessionState>();

export function getCreatorSession(userId: string): CreatorSessionState {
  const current = creatorSessions.get(userId);
  if (current) return current;

  const initial: CreatorSessionState = {
    provider: "ollama_local",
    bridge_enabled: false,
    bridge_model: "openai",
  };
  creatorSessions.set(userId, initial);
  return initial;
}

export function setCreatorProvider(userId: string, provider: CreatorProvider): CreatorSessionState {
  const session = getCreatorSession(userId);
  session.provider = provider;
  creatorSessions.set(userId, session);
  return session;
}

export function setCreatorBridgeModel(userId: string, bridgeModel: CreatorBridgeModel): CreatorSessionState {
  const session = getCreatorSession(userId);
  session.bridge_model = bridgeModel;
  creatorSessions.set(userId, session);
  return session;
}

export function enableCreatorBridge(userId: string, consentToken: string): CreatorSessionState {
  const session = getCreatorSession(userId);
  session.bridge_enabled = true;
  session.provider = "creator_bridge";
  session.consent_token = consentToken;
  creatorSessions.set(userId, session);
  return session;
}

export function disableCreatorBridge(userId: string): CreatorSessionState {
  const session = getCreatorSession(userId);
  session.bridge_enabled = false;
  session.provider = "ollama_local";
  delete session.consent_token;
  creatorSessions.set(userId, session);
  return session;
}
