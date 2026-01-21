export type ProviderChoice = {
  provider: "local" | "openai";
  model: string; // always prefixed: openai:... or local:...
};

export function chooseProvider(input: {
  requested_model?: string;
  has_openai_key: boolean;
  has_local_base_url: boolean;
  local_default_model?: string;
}): ProviderChoice {
  if (input.has_openai_key) {
    const m = (input.requested_model && input.requested_model.trim())
      ? input.requested_model.trim()
      : "gpt-4o-mini";
    return { provider: "openai", model: `openai:${m.replace(/^openai:/, "")}` };
  }
  if (input.has_local_base_url) {
    const m =
      (input.requested_model && input.requested_model.trim()) ||
      (input.local_default_model && input.local_default_model.trim()) ||
      "local-model";
    return { provider: "local", model: `local:${m.replace(/^local:/, "")}` };
  }
  return { provider: "local", model: "local:local-demo" };
}
