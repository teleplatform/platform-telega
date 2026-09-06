import * as fs from "fs";
import * as path from "path";
import { LocalFallbackMode } from"./localSafeCall.js";

const SETTINGS_FILE = path.resolve(".data/local-fallback-settings.json");

interface ChatFallbackSetting {
  chatId: string;
  mode: LocalFallbackMode;
  updatedAt: number;
}

function loadAll(): Record<string, ChatFallbackSetting> {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return {};
    const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, ChatFallbackSetting>): void {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // silent
  }
}

export function getFallbackMode(chatId: string): LocalFallbackMode {
  const all = loadAll();
  return all[chatId]?.mode || "local_then_cloud";
}

export function setFallbackMode(chatId: string, mode: LocalFallbackMode): void {
  const all = loadAll();
  all[chatId] = { chatId, mode, updatedAt: Date.now() };
  saveAll(all);
}

export function getFallbackModeLabel(mode: LocalFallbackMode): string {
  return mode === "local_only"
    ? "🔒 Local Only — strict offline/private mode"
    : "☁️ Local → Cloud — resilient mode with cloud escape";
}
