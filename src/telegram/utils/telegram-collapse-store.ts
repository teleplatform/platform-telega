/**
 * TGR-6.91 — Full-text storage for expand/collapse callbacks
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Language } from "../../providers/creator/i18n.js";

const STORE_PATH = path.join(process.cwd(), "data/telegram/response-collapse-store.jsonl");
const TTL_MS = 24 * 60 * 60 * 1000;

export interface StoredCollapsedResponse {
  response_id: string;
  full_text: string;
  preview_text: string;
  user_id: string;
  chat_id: string;
  lang: Language;
  created_at: number;
}

const store = new Map<string, StoredCollapsedResponse>();

function makeId(): string {
  return crypto.randomBytes(5).toString("hex");
}

async function persist(record: StoredCollapsedResponse): Promise<void> {
  try {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.appendFile(STORE_PATH, `${JSON.stringify(record)}\n`, "utf-8");
  } catch (err) {
    console.error("[telegram-collapse-store] persist failed", err);
  }
}

export function saveCollapsedResponse(input: {
  full_text: string;
  preview_text: string;
  user_id: string;
  chat_id: string;
  lang: Language;
}): StoredCollapsedResponse | null {
  const full = String(input.full_text || "");
  const preview = String(input.preview_text || "");
  if (!full.trim() || !preview.trim()) return null;

  const response_id = makeId();
  const record: StoredCollapsedResponse = {
    response_id,
    full_text: full,
    preview_text: preview,
    user_id: input.user_id,
    chat_id: input.chat_id,
    lang: input.lang,
    created_at: Date.now(),
  };

  store.set(response_id, record);
  void persist(record);
  return record;
}

export function getCollapsedResponse(responseId: string): StoredCollapsedResponse | undefined {
  const record = store.get(responseId);
  if (!record) return undefined;
  if (Date.now() - record.created_at > TTL_MS) {
    store.delete(responseId);
    return undefined;
  }
  return record;
}

export function hasStoredFullText(responseId: string): boolean {
  const record = getCollapsedResponse(responseId);
  return Boolean(record?.full_text?.trim());
}
