import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../db.ts";

export type KnowledgePackV1 = {
  id: string;
  version: string;
  brand_terms?: string[];
  currency?: string;
  price_list?: any[];
  faq?: any[];
  delivery?: any;
  warranty?: any;
  policies?: any;
};

export async function loadKnowledgePackV1(
  packId: string
): Promise<{ pack: KnowledgePackV1; source: "file" }> {
  const p = path.join(process.cwd(), "knowledge", "packs", `${packId}.json`);
  const raw = await fs.readFile(p, "utf-8");
  const pack = JSON.parse(raw);
  if (!pack?.id || !pack?.version) throw new Error("invalid_knowledge_pack");
  return { pack, source: "file" };
}

export async function loadKnowledgePackV2(
  packId: string
): Promise<{ pack: KnowledgePackV1; source: "db" | "file"; version: number | string; etag: string }> {
  const dbEntry = db.kb.get(packId);
  if (dbEntry) {
    const pack = safeParseJson(dbEntry.payload_json);
    if (!pack?.id || !pack?.version) throw new Error("invalid_knowledge_pack");
    return {
      pack,
      source: "db",
      version: dbEntry.version,
      etag: dbEntry.etag,
    };
  }

  const p = path.join(process.cwd(), "knowledge", "packs", `${packId}.json`);
  const raw = await fs.readFile(p, "utf-8");
  const pack = JSON.parse(raw);
  if (!pack?.id || !pack?.version) throw new Error("invalid_knowledge_pack");

  return {
    pack,
    source: "file",
    version: pack.version,
    etag: `file:${pack.version}`,
  };
}

function safeParseJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
