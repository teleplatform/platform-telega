export type PolicyConfig = {
  allowModelPrefixes: string[]; // e.g. ["openai:*", "local:*"]
};

export function loadPolicyConfig(env: NodeJS.ProcessEnv): PolicyConfig {
  const raw = (env.TELEGPT_POLICY_ALLOW_MODELS || "openai:*,local:*").split(",").map(s => s.trim()).filter(Boolean);
  return { allowModelPrefixes: raw };
}

export function isModelAllowed(model: string, allow: string[]): boolean {
  // exact or prefix wildcard "openai:*"
  for (const rule of allow) {
    if (rule.endsWith("*")) {
      const p = rule.slice(0, -1);
      if (model.startsWith(p)) return true;
    } else {
      if (model === rule) return true;
    }
  }
  return false;
}