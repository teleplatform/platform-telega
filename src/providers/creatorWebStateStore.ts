import { promises as fs } from "node:fs";
import path from "node:path";

export type ProviderStatus = "normal" | "slow" | "paused" | "blocked";

export type ProviderState = {
  actions_10m: number[];
  actions_day: number[];
  last_action_at: number | null;
  paused_until: number;
  status: ProviderStatus;
  relogin_required: boolean;
  relogin_reason: string;
  relogin_at: number;
  last_runner_job_id?: string;
  last_trace_id?: string;
  last_runner_action?: "web:login" | "web:health";
  last_runner_status?: "queued" | "running" | "done" | "failed";
  last_runner_updated_at?: number;
};

export type CreatorWebStateFile = {
  version: 1;
  updated_at: number;
  providers: Record<string, ProviderState>;
};

const DEFAULT_STATE: CreatorWebStateFile = {
  version: 1,
  updated_at: 0,
  providers: {},
};

function ensureProvider(state: CreatorWebStateFile, provider_id: string): ProviderState {
  const p = state.providers[provider_id];
  if (p) return p;
  const init: ProviderState = {
    actions_10m: [],
    actions_day: [],
    last_action_at: null,
    paused_until: 0,
    status: "normal",
    relogin_required: false,
    relogin_reason: "",
    relogin_at: 0,
  };
  state.providers[provider_id] = init;
  return init;
}

function pruneWindow(times: number[], now: number, windowMs: number): number[] {
  const cutoff = now - windowMs;
  return times.filter((t) => t >= cutoff);
}

export class CreatorWebStateStore {
  private filePath: string;
  private state: CreatorWebStateFile;

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(process.cwd(), "data", "creator-web-state.json");
    this.state = { ...DEFAULT_STATE, providers: {} };
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const json = JSON.parse(raw) as CreatorWebStateFile;
      if (json && json.version === 1 && json.providers) {
        this.state = json;
        return;
      }
    } catch {
      // ignore
    }
    this.state = { ...DEFAULT_STATE, providers: { ...this.state.providers } };
  }

  getSnapshot(): CreatorWebStateFile {
    return this.state;
  }

  recordAction(provider_id: string, now: number): ProviderState {
    const p = ensureProvider(this.state, provider_id);

    p.last_action_at = now;
    p.actions_10m.push(now);
    p.actions_day.push(now);

    p.actions_10m = pruneWindow(p.actions_10m, now, 10 * 60 * 1000);
    p.actions_day = pruneWindow(p.actions_day, now, 24 * 60 * 60 * 1000);

    this.state.updated_at = now;
    return p;
  }

  setStatus(provider_id: string, status: ProviderStatus, now: number): ProviderState {
    const p = ensureProvider(this.state, provider_id);
    p.status = status;
    this.state.updated_at = now;
    return p;
  }

  pause(provider_id: string, pauseMs: number, now: number): ProviderState {
    const p = ensureProvider(this.state, provider_id);
    p.status = "paused";
    p.paused_until = Math.max(p.paused_until, now + pauseMs);
    this.state.updated_at = now;
    return p;
  }

  unpauseIfExpired(provider_id: string, now: number): ProviderState {
    const p = ensureProvider(this.state, provider_id);

    p.actions_10m = pruneWindow(p.actions_10m, now, 10 * 60 * 1000);
    p.actions_day = pruneWindow(p.actions_day, now, 24 * 60 * 60 * 1000);

    if (p.status === "paused" && p.paused_until > 0 && now >= p.paused_until) {
      p.status = "normal";
      p.paused_until = 0;
      this.state.updated_at = now;
    }

    return p;
  }

  markReloginRequired(provider_id: string, reason: string) {
    const p = ensureProvider(this.state, provider_id);
    p.status = "blocked";
    p.paused_until = 0;
    p.relogin_required = true;
    p.relogin_reason = reason;
    p.relogin_at = Date.now();
    this.state.updated_at = Date.now();
  }

  clearRelogin(provider_id: string) {
    const p = ensureProvider(this.state, provider_id);
    p.relogin_required = false;
    p.relogin_reason = "";
    p.relogin_at = 0;
    if (p.status === "blocked") p.status = "normal";
    this.state.updated_at = Date.now();
  }

  setRunnerLink(provider_id: string, link: {
    job_id: string;
    trace_id: string;
    action: "web:login" | "web:health";
    status: "queued" | "running" | "done" | "failed";
  }) {
    const p = ensureProvider(this.state, provider_id);
    p.last_runner_job_id = link.job_id;
    p.last_trace_id = link.trace_id;
    p.last_runner_action = link.action;
    p.last_runner_status = link.status;
    p.last_runner_updated_at = Date.now();
    this.state.updated_at = Date.now();
  }

  async save(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    const tmp = this.filePath + ".tmp";
    const payload = JSON.stringify(this.state, null, 2);
    await fs.writeFile(tmp, payload, "utf8");
    await fs.rename(tmp, this.filePath);
  }
}
