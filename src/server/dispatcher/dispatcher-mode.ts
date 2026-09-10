import { promises as fs } from "node:fs";
import * as path from "node:path";

export type Dispatcher6CMode = "off" | "shadow";

export interface Dispatcher6CState {
  mode: Dispatcher6CMode;
  killSwitch: boolean;
}

interface Dispatcher6CStateFile {
  version: 1;
  mode: Dispatcher6CMode;
  kill_switch: boolean;
  updated_at: number;
}

const DATA_DIR = (): string => process.env.TELEGPT_DATA_DIR ?? ".data";
const STORE_PATH = (): string =>
  path.join(DATA_DIR(), "runtime", "dispatcher-6c.json");

function envDefaultMode(): Dispatcher6CMode {
  return process.env.DISPATCHER_6C_MODE === "shadow" ? "shadow" : "off";
}

let state: Dispatcher6CStateFile = {
  version: 1,
  mode: envDefaultMode(),
  kill_switch: false,
  updated_at: Date.now(),
};

export function isDispatcherShadowEnabled(): boolean {
  return state.mode === "shadow" && !state.kill_switch;
}

export function getDispatcher6CState(): Dispatcher6CState {
  return { mode: state.mode, killSwitch: state.kill_switch };
}

function persist(): void {
  fs.writeFile(STORE_PATH(), JSON.stringify(state, null, 2), "utf8").catch(() => {});
}

export function setDispatcher6CMode(mode: Dispatcher6CMode): Dispatcher6CState {
  state = { ...state, mode, updated_at: Date.now() };
  persist();
  return getDispatcher6CState();
}

export function setDispatcherRouterKillSwitch(enabled: boolean): Dispatcher6CState {
  state = { ...state, kill_switch: enabled, updated_at: Date.now() };
  persist();
  return getDispatcher6CState();
}

export async function loadDispatcher6CState(): Promise<Dispatcher6CState> {
  try {
    const raw = await fs.readFile(STORE_PATH(), "utf8");
    const parsed = JSON.parse(raw) as Dispatcher6CStateFile;
    if (parsed && parsed.version === 1) {
      state = {
        version: 1,
        mode: parsed.mode === "shadow" ? "shadow" : "off",
        kill_switch: parsed.kill_switch === true,
        updated_at: parsed.updated_at,
      };
    }
  } catch {
    // no persisted state → env-derived default
  }
  return getDispatcher6CState();
}