// @ts-nocheck
import fs from "fs";
import path from "path";
import type { IntelCardV1, IntelIndexRowV1 } from "./intelTypes";
import { fingerprintFromLinks, fingerprintFromText } from "./intelDedupe";

export function getIntelPaths(telegaRoot: string) {
  const intelRoot = path.join(telegaRoot, "mission-control", "intel");
  const inbox = path.join(intelRoot, "inbox");
  const digests = path.join(intelRoot, "digests");
  const index = path.join(intelRoot, "index.json");
  return { intelRoot, inbox, digests, index };
}

export function loadIndex(telegaRoot: string): IntelIndexRowV1[] {
  const p = getIntelPaths(telegaRoot);
  if (!fs.existsSync(p.index)) return [];
  try {
    const raw = fs.readFileSync(p.index, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as IntelIndexRowV1[]) : [];
  } catch {
    return [];
  }
}

export function saveIntelCard(telegaRoot: string, card: IntelCardV1) {
  const p = getIntelPaths(telegaRoot);
  fs.mkdirSync(p.inbox, { recursive: true });
  fs.mkdirSync(p.digests, { recursive: true });

  // ✅ fingerprint + dedupe
  const fp = fingerprintFromLinks(card.links) || fingerprintFromText(card.raw.text);
  const idx = loadIndex(telegaRoot);
  const dup = idx.find((r) => r.fingerprint && r.fingerprint === fp);

  if (dup) {
    const jsonFile = dup.file;
    const mdFile = dup.file.replace(".json", ".md");
    return {
      jsonFile,
      mdFile,
      jsonPath: path.join(p.inbox, jsonFile),
      mdPath: path.join(p.inbox, mdFile),
      deduped: true as const,
      fingerprint: fp,
    };
  }

  const stamp = card.created_at.slice(0, 10);
  const jsonFile = `intel_${stamp}_${card.id}.json`;
  const mdFile = `intel_${stamp}_${card.id}.md`;
  const jsonPath = path.join(p.inbox, jsonFile);
  const mdPath = path.join(p.inbox, mdFile);

  fs.writeFileSync(jsonPath, JSON.stringify(card, null, 2), "utf8");

  const md = [
    `# Intel ${card.id}`,
    ``,
    `**Title:** ${card.title}`,
    `**Source:** ${card.source}`,
    `**Type:** ${card.type}`,
    `**Proposed Pack:** ${card.proposed_pack}`,
    `**Confidence:** ${card.confidence.toFixed(2)}`,
    `**Created:** ${card.created_at}`,
    ``,
    `## Summary`,
    ...card.summary.map((s) => `- ${s}`),
    ``,
    `## Links`,
    ...(card.links.length ? card.links.map((l) => `- ${l}`) : ["- (none)"]),
    ``,
    `## Signals`,
    ...card.signals.map((s) => `- ${s}`),
    ``,
    `## Tele•Ga Impact`,
    ...card.tele_ga_impact.map((s) => `- ${s}`),
    ``,
    `## Raw`,
    "```",
    card.raw.text.length > 4000 ? card.raw.text.slice(0, 4000) + "\n…(truncated)" : card.raw.text,
    "```",
    ``,
  ].join("\n");

  fs.writeFileSync(mdPath, md, "utf8");

  // ✅ индекс — один раз и полностью
  const row: IntelIndexRowV1 = {
    id: card.id,
    created_at: card.created_at,
    source: card.source,
    type: card.type,
    proposed_pack: card.proposed_pack,
    title: card.title,
    file: jsonFile,
    fingerprint: fp,
  };

  idx.unshift(row);
  fs.writeFileSync(p.index, JSON.stringify(idx.slice(0, 3000), null, 2), "utf8");

  return { jsonFile, mdFile, jsonPath, mdPath, deduped: false as const, fingerprint: fp };
}

export function listInboxJsonFiles(telegaRoot: string): string[] {
  const p = getIntelPaths(telegaRoot);
  if (!fs.existsSync(p.inbox)) return [];
  return fs
    .readdirSync(p.inbox)
    .filter((f) => f.endsWith(".json") && f.startsWith("intel_"))
    .sort()
    .reverse();
}

export function readIntelCardFile(telegaRoot: string, jsonFile: string) {
  const p = getIntelPaths(telegaRoot);
  const full = path.join(p.inbox, jsonFile);
  const raw = fs.readFileSync(full, "utf8");
  return JSON.parse(raw) as IntelCardV1;
}
