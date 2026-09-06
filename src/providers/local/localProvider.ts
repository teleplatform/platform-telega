import { LOCAL_MODELS, LocalModelEntry } from"./localModels.js";
import { callOllamaChat } from"./ollamaClient.js";
import { callLMStudioChat } from"./lmStudioClient.js";

export interface LocalProviderParams {
  providerId: string;
  prompt: string;
  system?: string;
  temperature?: number;
}

export interface LocalProviderResult {
  text: string;
  raw: unknown;
  modelId: string;
  modelName: string;
  transport: string;
}

export async function callLocalProvider(params: LocalProviderParams): Promise<LocalProviderResult> {
  const provider: LocalModelEntry | undefined = LOCAL_MODELS[params.providerId];

  if (!provider) {
    throw new Error(`Unknown local provider: ${params.providerId}. Available: ${Object.keys(LOCAL_MODELS).join(", ")}`);
  }

  let result: { text: string; raw: unknown };

  if (provider.transport === "ollama") {
    result = await callOllamaChat({
      model: provider.model,
      prompt: params.prompt,
      system: params.system,
      temperature: params.temperature,
    });
  } else if (provider.transport === "lmstudio") {
    result = await callLMStudioChat({
      model: provider.model,
      prompt: params.prompt,
      system: params.system,
      temperature: params.temperature,
    });
  } else {
    throw new Error(`Unsupported local transport: ${provider.transport}`);
  }

  return {
    ...result,
    modelId: provider.id,
    modelName: provider.name,
    transport: provider.transport,
  };
}
