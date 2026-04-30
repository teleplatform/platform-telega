import fs from "fs/promises";
import path from "path";

const PATCH_DIR = path.join(process.cwd(), "data/telegram/kilo-patches");
const PATCH_INDEX = path.join(PATCH_DIR, "index.jsonl");

interface KiloPatchPlan {
  plan_id: string;
  user_id: string;
  account_label: string;
  task: string;
  files: string[];
  diffs: Record<string, string>;
  status: "pending" | "approved" | "applied" | "failed" | "rolled_back";
  created_at: number;
  applied_at?: number;
  error?: string;
}

interface KiloApplyRecord {
  apply_id: string;
  plan_id: string;
  user_id: string;
  account_label: string;
  status: "started" | "completed" | "failed" | "rolled_back";
  verify_result?: {
    build_ok: boolean;
    git_diff_clean: boolean;
    error?: string;
  };
  error?: string;
  created_at: number;
  completed_at?: number;
}

const BLOCKED_PATTERNS = [
  /\.env$/i,
  /secrets?/i,
  /keys?/i,
  /credentials?/i,
  /node_modules\//i,
  /\.git\//i,
  /^\.env\./,
  /\.pem$/,
  /\.key$/,
  /id_rsa/,
  /id_ed25519/,
];

function isBlockedPath(filePath: string): boolean {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(filePath)) return true;
  }
  return false;
}

function getRiskLevel(files: string[]): "low" | "medium" | "high" {
  const blocked = files.filter(isBlockedPath);
  if (blocked.length > 0) return "high";
  if (files.length > 3) return "medium";
  return "low";
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as T[];
  } catch {
    return [];
  }
}

async function ensureDir() {
  try {
    await fs.mkdir(PATCH_DIR, { recursive: true });
  } catch {}
}

export async function registerPatchRoute(server: any) {
  await ensureDir();

  server.get("/forge/patches", async (_req: any, _reply: any) => {
    const patches = await readJsonl<KiloPatchPlan>(PATCH_INDEX);
    return {
      patches: patches.map((p) => ({
        ...p,
        risk_level: getRiskLevel(p.files),
        blocked_files: p.files.filter(isBlockedPath),
      })),
    };
  });

  server.get("/forge/patch/:id", async (req: any, _reply: any) => {
    const patches = await readJsonl<KiloPatchPlan>(PATCH_INDEX);
    const patch = patches.find((p) => p.plan_id === req.params.id);
    if (!patch) {
      return { error: "Patch not found" };
    }
    return {
      patch: {
        ...patch,
        risk_level: getRiskLevel(patch.files),
        blocked_files: patch.files.filter(isBlockedPath),
      },
    };
  });

  server.get("/forge/patch-dashboard", async (_req: any, _reply: any) => {
    const patches = await readJsonl<KiloPatchPlan>(PATCH_INDEX);

    const pending = patches.filter((p) => p.status === "pending");
    const applied = patches.filter((p) => p.status === "applied");
    const failed = patches.filter((p) => p.status === "failed");
    const rolledBack = patches.filter((p) => p.status === "rolled_back");

    return {
      stats: {
        totalPatches: patches.length,
        pendingPatches: pending.length,
        appliedPatches: applied.length,
        failedPatches: failed.length,
        rolledBackPatches: rolledBack.length,
      },
      recentPatches: patches.slice(-10).reverse(),
    };
  });
}