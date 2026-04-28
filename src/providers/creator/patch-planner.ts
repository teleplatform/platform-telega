import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const PATCH_DIR = path.join(process.cwd(), "data", "creator-bridge");
const PATCH_FILE = path.join(PATCH_DIR, "patch-plans.jsonl");
const MAX_PATCH_PLANS = 100;

export type RiskLevel = "low" | "medium" | "high";

export interface FileChange {
  path: string;
  reason: string;
  change_summary: string;
  risk_level: RiskLevel;
  proposed_diff?: string;
}

export interface PatchPlan {
  patch_id: string;
  task: string;
  files_to_change: FileChange[];
  commands_to_verify: string[];
  rollback_notes: string[];
  requires_approval: boolean;
  created_at: number;
  status: "pending" | "approved" | "rejected" | "applied";
}

export const VERIFY_COMMANDS = [
  "pnpm build", "npm run build", "pnpm tsc", "npm run tsc",
  "pnpm lint", "npm run lint",
  "pnpm test", "npm test",
  "git diff", "git status",
  "pnpm typecheck", "npm run typecheck",
];

export const BLOCKED_PATTERNS = [
  "write", "create", "modify", "edit",
  "git commit", "git push",
  "npm install", "pnpm add", "yarn add",
  "chmod", "chown", "sudo", "rm -rf",
];

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(PATCH_DIR, { recursive: true });
  } catch {}
}

async function appendPatch(patch: PatchPlan): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(patch) + "\n";
    await fs.appendFile(PATCH_FILE, line, "utf-8");
  } catch (e) {
    console.error("[patch] write failed", e);
  }
}

async function loadPatches(limit = MAX_PATCH_PLANS): Promise<PatchPlan[]> {
  const patches: PatchPlan[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(PATCH_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const recent = lines.slice(-limit);
    for (const line of recent) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.patch_id) {
          patches.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return patches;
}

function generatePatchId(): string {
  return `patch-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
}

export async function createPatchPlan(
  task: string,
  files: FileChange[]
): Promise<PatchPlan> {
  const patch: PatchPlan = {
    patch_id: generatePatchId(),
    task,
    files_to_change: files,
    commands_to_verify: VERIFY_COMMANDS.slice(0, 3),
    rollback_notes: [
      "Review changes with git diff before applying",
      "Run build/typecheck after changes",
      "Test locally before production",
    ],
    requires_approval: true,
    created_at: Date.now(),
    status: "pending",
  };
  
  for (const file of files) {
    if (!file.risk_level) {
      file.risk_level = "low";
    }
    if (!file.change_summary) {
      file.change_summary = "To be specified";
    }
  }
  
  await appendPatch(patch);
  console.log("[patch] created", patch.patch_id, files.length, "files");
  
  return patch;
}

export async function getPatchPlan(patchId: string): Promise<PatchPlan | undefined> {
  const patches = await loadPatches();
  return patches.find(p => p.patch_id === patchId);
}

export async function listPatchPlans(status?: string, limit = 10): Promise<PatchPlan[]> {
  const patches = await loadPatches();
  let filtered = patches;
  if (status) {
    filtered = patches.filter(p => p.status === status);
  }
  return filtered.slice(0, limit);
}

export function formatPatchPlan(patch: PatchPlan): string {
  const lines = [
    `📋 Patch Plan: ${patch.patch_id}`,
    `Task: ${patch.task}`,
    `Status: ${patch.status}`,
    `Created: ${new Date(patch.created_at).toLocaleString()}`,
    `\nFiles to change (${patch.files_to_change.length}):`,
  ];
  
  for (const file of patch.files_to_change) {
    const risk = file.risk_level === "high" ? "🔴" : file.risk_level === "medium" ? "🟡" : "🟢";
    lines.push(`  ${risk} ${file.path}: ${file.change_summary || file.reason}`);
  }
  
  if (patch.commands_to_verify.length > 0) {
    lines.push(`\nVerify with:\n- ${patch.commands_to_verify.join("\n- ")}`);
  }
  
  if (patch.rollback_notes.length > 0) {
    lines.push(`\nRollback notes:\n- ${patch.rollback_notes.join("\n- ")}`);
  }
  
  lines.push(`\n⚠️ This plan requires approval before applying`);
  
  return lines.join("\n");
}

export function isTaskAllowed(task: string): { allowed: boolean; reason?: string } {
  const lower = task.toLowerCase();
  
  for (const pattern of BLOCKED_PATTERNS) {
    if (lower.includes(pattern)) {
      return { allowed: false, reason: `Blocked: ${pattern}` };
    }
  }
  
  const dangerous = ["production", "deploy", "release", "publish"];
  for (const word of dangerous) {
    if (lower.includes(word)) {
      return { allowed: false, reason: `Requires extra review: ${word}` };
    }
  }
  
  return { allowed: true };
}