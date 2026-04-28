import { promises as fs } from "node:fs";
import * as path from "node:path";

export type RuntimeFlags = {
  version: 1;
  updated_at: number;
  creator_web_automation_kill_switch: boolean;
};

const DEFAULT_FLAGS = (): RuntimeFlags => ({
  version: 1,
  updated_at: Date.now(),
  creator_web_automation_kill_switch: false,
});

export class RuntimeFlagsStore {
  private filePath: string;
  private loaded = false;
  private flags: RuntimeFlags = DEFAULT_FLAGS();

  constructor(opts?: { filePath?: string }) {
    this.filePath = opts?.filePath ?? path.join(process.cwd(), "data", "runtime-flags.json");
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as RuntimeFlags;
      if (!parsed || parsed.version !== 1) {
        this.flags = DEFAULT_FLAGS();
      } else {
        this.flags = parsed;
      }
    } catch {
      this.flags = DEFAULT_FLAGS();
    }

    this.loaded = true;
  }

  get(): RuntimeFlags {
    return this.flags;
  }

  setKillSwitch(value: boolean): void {
    this.flags.creator_web_automation_kill_switch = value;
    this.flags.updated_at = Date.now();
  }

  async save(): Promise<void> {
    await this.load();
    const tmp = this.filePath + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(this.flags, null, 2), "utf8");
    await fs.rename(tmp, this.filePath);
  }
}
