import * as fs from "fs";
import * as path from "path";
import { CapsuleData } from "./capsuleTypes";

const CAPSULES_DIR = path.resolve(".data/capsules");

function ensureDir(): void {
  if (!fs.existsSync(CAPSULES_DIR)) fs.mkdirSync(CAPSULES_DIR, { recursive: true });
}

function capsulePath(capsuleId: string): string {
  return path.join(CAPSULES_DIR, `${capsuleId}.json`);
}

export const capsuleStore = {
  save(capsule: CapsuleData): void {
    ensureDir();
    fs.writeFileSync(capsulePath(capsule.manifest.capsuleId), JSON.stringify(capsule, null, 2), "utf-8");
  },

  load(capsuleId: string): CapsuleData | null {
    try {
      const filePath = capsulePath(capsuleId);
      if (!fs.existsSync(filePath)) return null;
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as CapsuleData;
    } catch {
      return null;
    }
  },

  getAll(): CapsuleData[] {
    ensureDir();
    try {
      return fs.readdirSync(CAPSULES_DIR)
        .filter((f) => f.endsWith(".json"))
        .map((f) => {
          try {
            return JSON.parse(fs.readFileSync(path.join(CAPSULES_DIR, f), "utf-8")) as CapsuleData;
          } catch {
            return null;
          }
        })
        .filter((c): c is CapsuleData => !!c)
        .sort((a, b) => (b.manifest.createdAt || 0) - (a.manifest.createdAt || 0));
    } catch {
      return [];
    }
  },

  delete(capsuleId: string): boolean {
    try {
      const filePath = capsulePath(capsuleId);
      if (!fs.existsSync(filePath)) return false;
      fs.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  },

  size(): number {
    ensureDir();
    try {
      return fs.readdirSync(CAPSULES_DIR).filter((f) => f.endsWith(".json")).length;
    } catch {
      return 0;
    }
  },
};
