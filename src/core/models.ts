export type ModelItem = {
  id: string;
  provider: "local" | "openai";
  title?: string;
};

export const MODELS: ModelItem[] = [
  { id: "local-demo", provider: "local", title: "Local demo (echo)" },
  { id: "openai:gpt-4o-mini", provider: "openai", title: "OpenAI GPT-4o mini" },
  { id: "openai:gpt-4.1-mini", provider: "openai", title: "OpenAI GPT-4.1 mini" },
];

export function listModels() {
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY?.trim();
  const filtered = hasOpenAIKey
    ? MODELS
    : MODELS.filter((m) => m.provider !== "openai");
  return {
    object: "list",
    data: filtered.map((m) => ({
      id: m.id,
      object: "model",
      owned_by: m.provider,
      title: m.title,
    })),
  };
}
