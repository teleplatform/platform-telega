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
  const hasLocal =
    !!process.env.LOCAL_OPENAI_BASE_URL?.trim() &&
    !!process.env.LOCAL_OPENAI_MODEL?.trim();

  const dynamic: ModelItem[] = [
    { id: "local:local-demo", provider: "local", title: "Local demo (echo)" },
  ];
  if (hasOpenAIKey) {
    dynamic.push(
      { id: "openai:gpt-4o-mini", provider: "openai", title: "OpenAI GPT-4o mini" },
      { id: "openai:gpt-4.1-mini", provider: "openai", title: "OpenAI GPT-4.1 mini" }
    );
  }
  if (hasLocal) {
    const localModel = process.env.LOCAL_OPENAI_MODEL!.trim();
    dynamic.push({ id: `local:${localModel}`, provider: "local" });
  }

  const filtered = dynamic;
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
