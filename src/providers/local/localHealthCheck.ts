import { checkOllamaHealth } from"./ollamaClient.js";
import { checkLMStudioHealth } from"./lmStudioClient.js";
import { LOCAL_MODELS } from"./localModels.js";
import * as fs from "fs";

export interface LocalHealthResult {
  ollama: { ok: boolean; models: string[]; availablePulls: string[] };
  lmStudio: { ok: boolean; models: string[] };
  aiDrive: { ok: boolean; path: string };
  modelsPresent: Array<{ id: string; name: string; found: boolean }>;
  overall: "ok" | "partial" | "offline";
}

export async function checkLocalHealth(): Promise<LocalHealthResult> {
  const [ollamaHealth, lmStudioHealth] = await Promise.all([
    checkOllamaHealth(),
    checkLMStudioHealth(),
  ]);

  const aiDrivePath = "/Volumes/AI_DRIVE";
  const aiDriveOk = fs.existsSync(aiDrivePath);

  // Check which local models are available in Ollama
  const ollamaModels = ollamaHealth.models;
  const modelsPresent = Object.values(LOCAL_MODELS).map((entry) => {
    const found = entry.transport === "ollama"
      ? ollamaModels.some((m) => m.includes(entry.model.split(":")[0]))
      : lmStudioHealth.models.some((m) => m.includes(entry.model.split(":")[0]));
    return { id: entry.id, name: entry.name, found };
  });

  // Available pulls: models in registry but not pulled yet
  const availablePulls = Object.values(LOCAL_MODELS)
    .filter((e) => e.transport === "ollama")
    .filter((e) => !ollamaModels.some((m) => m.includes(e.model.split(":")[0])))
    .map((e) => e.model);

  const anyOk = ollamaHealth.ok || lmStudioHealth.ok;
  const allOk = ollamaHealth.ok && lmStudioHealth.ok;

  return {
    ollama: { ...ollamaHealth, availablePulls },
    lmStudio: lmStudioHealth,
    aiDrive: { ok: aiDriveOk, path: aiDrivePath },
    modelsPresent,
    overall: allOk ? "ok" : anyOk ? "partial" : "offline",
  };
}
