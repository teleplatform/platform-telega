import fs from "node:fs";
import path from "node:path";
import { getBrowserSession } from "./browser-session.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export interface SessionCheckpoint {
  id: string;
  url: string;
  title: string;
  cookies: unknown[];
  localStorage: Record<string, string>;
  capturedAt: number;
  planId?: string;
  stepLabel?: string;
}

const CHECKPOINTS_DIR = ".data/runtime/browser/checkpoints";

function ensureDir(): string {
  const dir = path.join(process.cwd(), CHECKPOINTS_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function saveSessionCheckpoint(planId?: string, stepLabel?: string): Promise<SessionCheckpoint> {
  const session = getBrowserSession();
  const page = await session.getPage();

  const url = page.url();
  const title = await page.title();
  const cookies = await page.context().cookies();
  const localStorage = await page.evaluate(() => {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) data[key] = localStorage.getItem(key) || "";
    }
    return data;
  }).catch(() => ({}));

  const checkpoint: SessionCheckpoint = {
    id: `chk_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    url,
    title,
    cookies,
    localStorage,
    capturedAt: Date.now(),
    planId,
    stepLabel,
  };

  const dir = ensureDir();
  fs.writeFileSync(path.join(dir, `${checkpoint.id}.json`), JSON.stringify(checkpoint, null, 2), "utf-8");

  await appendEvidenceRecord({
    evidence_id: hashTraceId(checkpoint.id, "artifact_emitted"),
    trace_id: `brw_chk_${checkpoint.id}`,
    job_id: "browser_checkpoint",
    type: "artifact_emitted",
    timestamp: new Date().toISOString(),
    artifact_ids: [path.join(dir, `${checkpoint.id}.json`)],
    payload: { kind: "session_checkpoint", url, title, planId, stepLabel },
  });

  return checkpoint;
}

export async function restoreSessionCheckpoint(checkpointId: string): Promise<SessionCheckpoint | null> {
  const dir = ensureDir();
  const fp = path.join(dir, `${checkpointId}.json`);
  if (!fs.existsSync(fp)) return null;

  const raw = fs.readFileSync(fp, "utf-8");
  const checkpoint: SessionCheckpoint = JSON.parse(raw);

  const session = getBrowserSession();
  const page = await session.getPage();

  await page.goto(checkpoint.url, { waitUntil: "domcontentloaded", timeout: 30000 });

  if (checkpoint.cookies.length > 0) {
    await page.context().addCookies(checkpoint.cookies as any[]);
    await page.goto(checkpoint.url, { waitUntil: "domcontentloaded", timeout: 30000 });
  }

  if (Object.keys(checkpoint.localStorage).length > 0) {
    await page.evaluate((data) => {
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
    }, checkpoint.localStorage);
  }

  return checkpoint;
}

export function listCheckpoints(): SessionCheckpoint[] {
  const dir = ensureDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")); }
      catch { return null; }
    })
    .filter(Boolean) as SessionCheckpoint[];
}

export function clearCheckpoints(olderThanMs?: number): number {
  const dir = ensureDir();
  const now = Date.now();
  let cleared = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      const fp = path.join(dir, f);
      if (olderThanMs) {
        const stat = fs.statSync(fp);
        if (now - stat.mtimeMs < olderThanMs) continue;
      }
      fs.unlinkSync(fp);
      cleared++;
    } catch {}
  }
  return cleared;
}
