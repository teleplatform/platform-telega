import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const PATCH_DIR = path.join(process.cwd(), "data", "creator-bridge");
const APPLY_FILE = path.join(PATCH_DIR, "patch-applies.jsonl");
const BACKUPS_DIR = path.join(PATCH_DIR, "backups");

export interface ApplyRecord {
  apply_id: string;
  patch_id: string;
  task: string;
  applied_at: number;
  applied_by: string;
  status: "pending" | "applying" | "completed" | "failed" | "rolled_back";
  backup_created: boolean;
  verification_results: Array<{ command: string; ok: boolean; output: string }>;
  error?: string;
  files_changed: string[];
}

export const ALLOWED_VERIFY = [
  "pnpm build", "npm run build",
  "pnpm typecheck", "npm run typecheck",
  "git status", "git diff",
  "pnpm test", "npm test",
];

const BLOCKED_FILES = [
  ".env", ".env.local", ".env.production",
  "credentials", "secrets", "keys",
  ".pem", ".key", ".crt",
];

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

async function appendApply(record: ApplyRecord): Promise<void> {
  try {
    await ensureDir(PATCH_DIR);
    const line = JSON.stringify(record) + "\n";
    await fs.appendFile(APPLY_FILE, line, "utf-8");
  } catch (e) {
    console.error("[apply] write failed", e);
  }
}

async function loadApplies(limit = 50): Promise<ApplyRecord[]> {
  const records: ApplyRecord[] = [];
  try {
    await ensureDir(PATCH_DIR);
    const content = await fs.readFile(APPLY_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const recent = lines.slice(-limit);
    for (const line of recent) {
      try {
        records.push(JSON.parse(line));
      } catch {}
    }
  } catch {}
  return records;
}

function generateApplyId(): string {
  return `apply-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
}

async function createBackup(patchId: string, files: string[]): Promise<boolean> {
  const backupDir = path.join(BACKUPS_DIR, patchId);
  await ensureDir(backupDir);
  
  for (const file of files) {
    try {
      const filePath = path.join(process.cwd(), file);
      const backupPath = path.join(backupDir, file);
      await ensureDir(path.dirname(backupPath));
      await fs.copyFile(filePath, backupPath);
    } catch (e) {
      console.error("[apply] backup failed", file, e);
    }
  }
  return true;
}

export async function applyPatch(patchId: string, userId: string, patch: { files_to_change: Array<{ path: string }> }): Promise<ApplyRecord> {
  const files = patch.files_to_change?.map(f => f.path) || [];
  const applyId = generateApplyId();
  
  const record: ApplyRecord = {
    apply_id: applyId,
    patch_id: patchId,
    task: patch?.files_to_change?.[0]?.path || "unknown",
    applied_at: Date.now(),
    applied_by: userId,
    status: "applying",
    backup_created: false,
    verification_results: [],
    files_changed: files,
  };
  
  await appendApply(record);
  
  const backupOk = await createBackup(patchId, files);
  record.backup_created = backupOk;
  
  await appendApply(record);
  console.log("[apply] started", applyId, "backup:", backupOk);
  
  return record;
}

export async function verifyApply(applyId: string): Promise<ApplyRecord> {
  const applies = await loadApplies();
  const record = applies.find(a => a.apply_id === applyId);
  if (!record) {
    throw new Error("Apply not found");
  }
  
  for (const cmd of ALLOWED_VERIFY.slice(0, 3)) {
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 60000 });
      record.verification_results.push({
        command: cmd,
        ok: true,
        output: stdout.slice(0, 500) || "passed",
      });
    } catch (e: any) {
      record.verification_results.push({
        command: cmd,
        ok: false,
        output: e?.message || "failed",
      });
    }
    await appendApply(record);
  }
  
  const failures = record.verification_results.filter(r => !r.ok);
  if (failures.length > 0) {
    record.status = "failed";
  } else {
    record.status = "completed";
  }
  
  await appendApply(record);
  console.log("[apply] verified", applyId, record.status);
  
  return record;
}

async function rollbackApply(applyId: string): Promise<ApplyRecord> {
  const applies = await loadApplies();
  const record = applies.find(a => a.apply_id === applyId);
  if (!record) {
    throw new Error("Apply not found");
  }
  
  const backupDir = path.join(BACKUPS_DIR, record.patch_id);
  
  for (const file of record.files_changed) {
    try {
      const backupPath = path.join(backupDir, file);
      const currentPath = path.join(process.cwd(), file);
      await fs.copyFile(backupPath, currentPath);
    } catch (e) {
      console.error("[apply] rollback failed", file, e);
    }
  }
  
  record.status = "rolled_back";
  await appendApply(record);
  console.log("[apply] rolled back", applyId);
  
  return record;
}

export async function getApplyStatus(applyId: string): Promise<ApplyRecord | undefined> {
  const applies = await loadApplies();
  return applies.find(a => a.apply_id === applyId);
}

export { rollbackApply };

export function formatApplyStatus(record: ApplyRecord): string {
  const status = record.status === "completed" ? "✅" : record.status === "failed" ? "❌" : record.status === "rolled_back" ? "↩️" : "⏳";
  
  const lines = [
    `📝 Apply: ${record.apply_id}`,
    `Patch: ${record.patch_id}`,
    `Status: ${status}`,
    `By: ${record.applied_by}`,
    `At: ${new Date(record.applied_at).toLocaleString()}`,
    `Backup: ${record.backup_created ? "✅" : "❌"}`,
  ];
  
  if (record.verification_results.length > 0) {
    lines.push("\nVerification:");
    for (const v of record.verification_results) {
      lines.push(`  ${v.ok ? "✅" : "❌"} ${v.command}`);
    }
  }
  
  if (record.error) {
    lines.push(`\nError: ${record.error}`);
  }
  
  return lines.join("\n");
}