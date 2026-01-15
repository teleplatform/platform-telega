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
  return {
    object: "list",
    data: MODELS.map((m) => ({
      id: m.id,
      object: "model",
      owned_by: m.provider,
      title: m.title,
    })),
  };
}
