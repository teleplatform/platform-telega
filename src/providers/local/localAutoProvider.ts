import { resolveLocalIntent, LocalIntent } from"./localIntentResolver.js";
import { selectBestModelForIntent } from"./adaptiveRouter.js";
import { getFirstAvailableModel } from"./localSmartSelector.js";
import { callLocalProvider } from"./localProvider.js";
import { checkOllamaHealth } from"./ollamaClient.js";
import { writeLocalProviderEvidence } from"./localEvidence.js";

export interface AutoLocalResult {
  text: string;
  raw: unknown;
  intent: LocalIntent;
  selectedModel: string;
  selectedModelName: string;
  usedFallback: boolean;
  fallbackChain: string[];
  latencyMs: number;
}

export async function callLocalAuto(
  prompt: string,
  system?: string
): Promise<AutoLocalResult> {
  const t0 = Date.now();
  writeLocalProviderEvidence("local_auto_started", "auto", "Auto", "ollama", { promptLength: prompt.length });

  const intent = resolveLocalIntent(prompt);
  writeLocalProviderEvidence("local_auto_intent_resolved", "auto", intent, "ollama");

  const adaptive = await selectBestModelForIntent(intent);
  const fallbackChain = adaptive.fallbackChain;
  writeLocalProviderEvidence("local_auto_model_selected", "auto", intent, "ollama", {
    chain: fallbackChain.join(", "),
    adaptiveScore: adaptive.score,
    selectedModel: adaptive.modelId,
  });

  const ollamaHealth = await checkOllamaHealth();
  const availableModels = ollamaHealth.models;
  const ollamaAvailable = ollamaHealth.ok;

  let selectedModel: string | null = null;
  let selectedModelName = "";
  let usedFallback = false;
  let lastError: string | null = null;

  if (ollamaAvailable) {
    selectedModel = getFirstAvailableModel(fallbackChain, availableModels);
  }

  // If Ollama not available or no model found, try LM Studio for local:auto
  if (!selectedModel || !ollamaAvailable) {
    // Check LM Studio for applicable models (TranslateGemma)
    const { checkLMStudioHealth } = await import("./lmStudioClient.js");
    const lmStudioHealth = await checkLMStudioHealth();

    if (lmStudioHealth.ok && intent === "translation") {
      if (lmStudioHealth.models.some((m) => m.includes("translategemma"))) {
        selectedModel = "translategemma";
      }
    }
  }

  if (!selectedModel) {
    // Last resort: try any available Ollama model
    if (availableModels.length > 0) {
      selectedModel = "gemma3n"; // always in registry, may not be pulled
    }
  }

  if (!selectedModel) {
    writeLocalProviderEvidence("local_auto_failed", "auto", "Auto", "ollama", {
      error: "No available model found",
      intent,
    });

    throw new Error(
      `No available local model for intent "${intent}". Fallback chain: ${fallbackChain.join(" → ")}. Check /local_health`
    );
  }

  const originalModel = selectedModel;
  let success = false;

  for (let attempt = 0; attempt < fallbackChain.length; attempt++) {
    const candidate = attempt === 0 ? selectedModel : fallbackChain[attempt];

    if (attempt > 0) {
      usedFallback = true;
      selectedModel = candidate;
      selectedModelName = fallbackChain[attempt];
      writeLocalProviderEvidence("local_auto_fallback_used", "auto", intent, "ollama", {
        fallbackIndex: attempt,
        model: candidate,
      });
    }

    try {
      const result = await callLocalProvider({
        providerId: candidate,
        prompt,
        system,
      });

      selectedModel = candidate;
      selectedModelName = result.modelName;
      success = true;

      const latencyMs = Date.now() - t0;
      writeLocalProviderEvidence("local_auto_completed", "auto", "Auto", "ollama", {
        intent,
        model: candidate,
        latencyMs,
        usedFallback,
        outputLength: result.text.length,
      });

      return {
        text: result.text,
        raw: result.raw,
        intent,
        selectedModel,
        selectedModelName,
        usedFallback,
        fallbackChain,
        latencyMs,
      };
    } catch (e) {
      lastError = (e as Error).message;
    }
  }

  if (!success) {
    writeLocalProviderEvidence("local_auto_failed", "auto", "Auto", "ollama", {
      intent,
      error: lastError,
    });
    throw new Error(
      `All models in fallback chain failed for intent "${intent}". Last error: ${lastError}`
    );
  }

  // Unreachable but TypeScript needs it
  throw new Error("Unexpected error in local auto provider");
}
