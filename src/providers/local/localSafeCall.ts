import { getTimeoutForModel } from"./localTimeoutPolicy.js";
import { callLocalProvider, LocalProviderResult } from"./localProvider.js";
import { callLocalAuto, AutoLocalResult } from"./localAutoProvider.js";
import { LOCAL_MODELS, getLocalModel } from"./localModels.js";
import { writeLocalProviderEvidence } from"./localEvidence.js";

export type LocalFallbackMode = "local_only" | "local_then_cloud";

export interface SafeCallResult {
  text: string;
  raw: unknown;
  usedFallbackChain: boolean;
  usedCloudEscape: boolean;
  finalModelId: string;
  finalModelName: string;
  latencyMs: number;
  error?: string;
}

function callWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return new Promise<T>(async (resolve, reject) => {
    const timer = setTimeout(() => {
      writeLocalProviderEvidence("local_timeout_triggered", label, label, "ollama", { timeoutMs });
      reject(new Error(`Timeout after ${timeoutMs}ms: ${label}`));
    }, timeoutMs);

    try {
      writeLocalProviderEvidence("local_timeout_started", label, label, "ollama", { timeoutMs });
      const result = await fn();
      clearTimeout(timer);
      resolve(result);
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

export async function callLocalWithFailover(
  providerId: string,
  prompt: string,
  system?: string,
  fallbackMode: LocalFallbackMode = "local_then_cloud"
): Promise<SafeCallResult> {
  const t0 = Date.now();
  const entry = getLocalModel(providerId);
  const modelName = entry?.name || providerId;
  const timeoutMs = getTimeoutForModel(providerId);

  // Try primary model with timeout
  try {
    writeLocalProviderEvidence("local_failover_started", providerId, modelName, "ollama", { timeoutMs });
    const result = await callWithTimeout(
      () => callLocalProvider({ providerId, prompt, system }),
      timeoutMs,
      providerId
    );
    writeLocalProviderEvidence("local_failover_model_succeeded", providerId, modelName, "ollama", { latencyMs: Date.now() - t0 });
    return {
      text: result.text,
      raw: result.raw,
      usedFallbackChain: false,
      usedCloudEscape: false,
      finalModelId: providerId,
      finalModelName: modelName,
      latencyMs: Date.now() - t0,
    };
  } catch (primaryError) {
    writeLocalProviderEvidence("local_failover_model_failed", providerId, modelName, "ollama", { error: (primaryError as Error).message });

    // Try fallback chain from local models
    const fallbackChain = Object.keys(LOCAL_MODELS).filter((id) => id !== providerId);
    for (const fallbackId of fallbackChain) {
      const fbEntry = getLocalModel(fallbackId);
      if (!fbEntry) continue;
      const fbTimeout = getTimeoutForModel(fallbackId);
      try {
        const result = await callWithTimeout(
          () => callLocalProvider({ providerId: fallbackId, prompt, system }),
          fbTimeout,
          fallbackId
        );
        writeLocalProviderEvidence("local_failover_model_succeeded", fallbackId, fbEntry.name, "ollama", { latencyMs: Date.now() - t0 });
        return {
          text: result.text,
          raw: result.raw,
          usedFallbackChain: true,
          usedCloudEscape: false,
          finalModelId: fallbackId,
          finalModelName: fbEntry.name,
          latencyMs: Date.now() - t0,
          error: `Primary model ${modelName} failed: ${(primaryError as Error).message}`,
        };
      } catch {
        writeLocalProviderEvidence("local_failover_model_failed", fallbackId, fbEntry.name, "ollama", { error: "timeout or error" });
      }
    }

    // All local failed — cloud escape hatch
    if (fallbackMode === "local_then_cloud") {
      writeLocalProviderEvidence("local_cloud_escape_started", providerId, modelName, "ollama", { error: (primaryError as Error).message });
      try {
        const cloudResult = await callWithTimeout(
          () => callCloudFallback(prompt, system),
          60_000,
          "cloud_escape"
        );
        writeLocalProviderEvidence("local_cloud_escape_completed", "cloud", "Cloud Fallback", "api", { latencyMs: Date.now() - t0 });
        return {
          text: cloudResult.text,
          raw: cloudResult.raw,
          usedFallbackChain: true,
          usedCloudEscape: true,
          finalModelId: "cloud_fallback",
          finalModelName: "Cloud Fallback",
          latencyMs: Date.now() - t0,
          error: `All local models failed. Fell back to cloud: ${(primaryError as Error).message}`,
        };
      } catch (cloudError) {
        writeLocalProviderEvidence("local_cloud_escape_blocked", "cloud", "Cloud Fallback", "api", { error: (cloudError as Error).message });
        throw new Error(
          `All local models and cloud fallback failed. Last local error: ${(primaryError as Error).message}. Cloud error: ${(cloudError as Error).message}`
        );
      }
    }

    // local_only mode — throw
    writeLocalProviderEvidence("local_cloud_escape_blocked", "cloud", "Cloud Fallback", "api", { reason: "local_only mode" });
    throw new Error(
      `All local models failed (local_only mode). Last error: ${(primaryError as Error).message}`
    );
  }
}

export async function callLocalAutoWithFailover(
  prompt: string,
  system?: string,
  fallbackMode: LocalFallbackMode = "local_then_cloud"
): Promise<SafeCallResult> {
  const t0 = Date.now();

  try {
    writeLocalProviderEvidence("local_failover_started", "auto", "Auto Selector", "ollama");
    const result = await callWithTimeout(
      () => callLocalAuto(prompt, system),
      90_000,
      "local:auto"
    );
    return {
      text: result.text,
      raw: result.raw,
      usedFallbackChain: false,
      usedCloudEscape: false,
      finalModelId: result.selectedModel,
      finalModelName: result.selectedModelName,
      latencyMs: Date.now() - t0,
    };
  } catch (autoError) {
    writeLocalProviderEvidence("local_failover_model_failed", "auto", "Auto Selector", "ollama", { error: (autoError as Error).message });

    // Try each model directly
    for (const modelId of Object.keys(LOCAL_MODELS)) {
      const entry = getLocalModel(modelId);
      if (!entry) continue;
      try {
        const result = await callWithTimeout(
          () => callLocalProvider({ providerId: modelId, prompt, system }),
          getTimeoutForModel(modelId),
          modelId
        );
        return {
          text: result.text,
          raw: result.raw,
          usedFallbackChain: true,
          usedCloudEscape: false,
          finalModelId: modelId,
          finalModelName: entry.name,
          latencyMs: Date.now() - t0,
          error: `Auto selection failed, fell back to ${entry.name}`,
        };
      } catch {
        // continue
      }
    }

    // Cloud escape
    if (fallbackMode === "local_then_cloud") {
      writeLocalProviderEvidence("local_cloud_escape_started", "auto", "Auto Selector", "ollama");
      try {
        const cloudResult = await callCloudFallback(prompt, system);
        return {
          text: cloudResult.text,
          raw: cloudResult.raw,
          usedFallbackChain: true,
          usedCloudEscape: true,
          finalModelId: "cloud_fallback",
          finalModelName: "Cloud Fallback",
          latencyMs: Date.now() - t0,
          error: `All local models failed. Cloud fallback used.`,
        };
      } catch (cloudError) {
        throw new Error(`All local + cloud failed: ${(cloudError as Error).message}`);
      }
    }

    throw new Error(`All local models failed (local_only mode): ${(autoError as Error).message}`);
  }
}

async function callCloudFallback(prompt: string, system?: string): Promise<LocalProviderResult> {
  // Try OpenAI API as primary cloud escape
  const openaiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            ...(system ? [{ role: "system", content: system }] : []),
            { role: "user", content: prompt },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || "";
        return { text, raw: data, modelId: "openai", modelName: "GPT-4o-mini", transport: "api" };
      }
    } catch {
      // fall through
    }
  }

  // Try DeepSeek API
  const dsKey = (process.env.DEEPSEEK_API_KEY || "").trim();
  if (dsKey) {
    try {
      const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${dsKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            ...(system ? [{ role: "system", content: system }] : []),
            { role: "user", content: prompt },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || "";
        return { text, raw: data, modelId: "deepseek", modelName: "DeepSeek Chat", transport: "api" };
      }
    } catch {
      // fall through
    }
  }

  throw new Error("No cloud fallback available: no API keys configured");
}
