// @ts-nocheck
import fs from "fs";
import path from "path";
import type { IntelCardV1 } from "./intelTypes";
import { getIntelPaths, listInboxJsonFiles, readIntelCardFile } from "./intelStore";

type PackCandidate = { pack: string; count: number; score: number };
type RepeatSignal = { key: string; count: number; examples: string[] };

function groupByPack(cards: IntelCardV1[]) {
  const out: Record<string, IntelCardV1[]> = {};
  for (const c of cards) {
    const key = c.proposed_pack || "Other";
    if (!out[key]) out[key] = [];
    out[key].push(c);
  }
  return out;
}

function calcPackCandidates(cards: IntelCardV1[]): PackCandidate[] {
  const byPack = groupByPack(cards);
  const out: PackCandidate[] = [];
  for (const [pack, arr] of Object.entries(byPack)) {
    const count = arr.length;
    const score = arr.reduce((s, c) => s + (c.confidence || 0), 0);
    out.push({ pack, count, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

function calcRepeats(cards: IntelCardV1[]): RepeatSignal[] {
  const map = new Map<string, { count: number; examples: string[] }>();
  for (const c of cards) {
    for (const s of c.signals || []) {
      const cur = map.get(s) || { count: 0, examples: [] };
      cur.count += 1;
      if (cur.examples.length < 3) cur.examples.push(c.title);
      map.set(s, cur);
    }
  }
  const out: RepeatSignal[] = [];
  for (const [key, v] of map.entries()) out.push({ key, count: v.count, examples: v.examples });
  return out.sort((a, b) => b.count - a.count).slice(0, 12);
}

export function runDigest(opts: { telegaRoot: string; takeLastN?: number }) {
  const telegaRoot = opts.telegaRoot;
  const take = Math.max(1, Number(opts.takeLastN ?? 25));
  const files = listInboxJsonFiles(telegaRoot);
  const cards = files.slice(0, take).map((f) => readIntelCardFile(telegaRoot, f));
  if (cards.length === 0) {
    throw new Error("intel_inbox_empty");
  }

  const packCandidates = calcPackCandidates(cards);
  const repeats = calcRepeats(cards);
  const groupedByPack = groupByPack(cards);

  const stamp = new Date().toISOString().slice(0, 10);
  const digestId = Math.random().toString(36).slice(2, 10);
  const digestJson = {
    schema: "PANTHEON_DIGEST_V1",
    digest_id: digestId,
    created_at: new Date().toISOString(),
    total_cards: cards.length,
    pack_candidates: packCandidates,
    repeats,
  };

  const p = getIntelPaths(telegaRoot);
  fs.mkdirSync(p.digests, { recursive: true });

  const digestMdLines: string[] = [];
  digestMdLines.push(`# Digest ${stamp}`);
  digestMdLines.push(``);
  digestMdLines.push(`**Digest ID:** ${digestId}`);
  digestMdLines.push(`**Cards:** ${cards.length} (last ${take})`);
  digestMdLines.push(`**Created:** ${digestJson.created_at}`);
  digestMdLines.push(``);

  digestMdLines.push(`## Top pack candidates`);
  for (const pck of packCandidates) {
    digestMdLines.push(`- **${pck.pack}** — ${pck.count} signals (score ${pck.score.toFixed(2)})`);
  }
  digestMdLines.push(``);

  digestMdLines.push(`## Repeat signals (most frequent)`);
  for (const r of repeats) {
    digestMdLines.push(`- **${r.key}** — ${r.count}×`);
    for (const ex of r.examples) digestMdLines.push(`  - ${ex}`);
  }
  digestMdLines.push(``);

  digestMdLines.push(`## By pack`);
  for (const [pack, arr] of Object.entries(groupedByPack)) {
    digestMdLines.push(`### ${pack} (${arr.length})`);
    for (const c of arr.slice(0, 20)) {
      const link = c.links[0] ? ` — ${c.links[0]}` : "";
      digestMdLines.push(`- ${c.title} *(conf ${c.confidence.toFixed(2)})*${link}`);
    }
    if (arr.length > 20) digestMdLines.push(`- …(+${arr.length - 20} more)`);
    digestMdLines.push(``);
  }

  digestMdLines.push(`## What to implement next (draft)`);
  for (const c of packCandidates.slice(0, 3)) {
    digestMdLines.push(
      `- Candidate Pack: **${c.pack}** — собрать Pack-spec и оценить текущий статус в Tele•Ga Canon.`
    );
  }
  digestMdLines.push(``);

  const digestJsonFile = `digest_${stamp}_${digestId}.json`;
  const digestMdFile = `digest_${stamp}_${digestId}.md`;
  const digestJsonPath = path.join(p.digests, digestJsonFile);
  const digestMdPath = path.join(p.digests, digestMdFile);

  fs.writeFileSync(digestJsonPath, JSON.stringify(digestJson, null, 2), "utf8");
  fs.writeFileSync(digestMdPath, digestMdLines.join("\n"), "utf8");

  return {
    digestId,
    digestJsonFile,
    digestMdFile,
    digestJsonPath,
    digestMdPath,
    totalCards: cards.length,
    packCandidates,
  };
}

function withinLastDays(iso: string, days: number): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  const ms = days * 24 * 60 * 60 * 1000;
  return now - t <= ms;
}

export function runDigestWeekly(opts: { telegaRoot: string; days?: number; takeMax?: number }) {
  const telegaRoot = opts.telegaRoot;
  const days = Math.max(1, Number(opts.days ?? 7));
  const takeMax = Math.max(10, Number(opts.takeMax ?? 300));

  const files = listInboxJsonFiles(telegaRoot);
  const cardsAll = files.slice(0, takeMax).map((f) => readIntelCardFile(telegaRoot, f));
  const cards = cardsAll.filter((c) => withinLastDays(c.created_at, days));

  if (cards.length === 0) throw new Error("weekly_empty");

  const packCandidates = calcPackCandidates(cards);
  const repeats = calcRepeats(cards);
  const groupedByPack = groupByPack(cards);

  const stamp = new Date().toISOString().slice(0, 10);
  const digestId = "weekly_" + Math.random().toString(36).slice(2, 10);

  const digestJson = {
    schema: "PANTHEON_DIGEST_V1",
    digest_id: digestId,
    created_at: new Date().toISOString(),
    total_cards: cards.length,
    pack_candidates: packCandidates,
    repeats,
    window_days: days,
  };

  const p = getIntelPaths(telegaRoot);
  fs.mkdirSync(p.digests, { recursive: true });

  const md: string[] = [];
  md.push(`# Weekly Digest (last ${days} days)`);
  md.push("");
  md.push(`**Digest ID:** ${digestId}`);
  md.push(`**Cards:** ${cards.length}`);
  md.push(`**Created:** ${digestJson.created_at}`);
  md.push("");

  md.push(`## Top pack candidates`);
  for (const pck of packCandidates) {
    md.push(`- **${pck.pack}** — ${pck.count} signals (score ${pck.score.toFixed(2)})`);
  }
  md.push("");

  md.push(`## Repeat signals (most frequent)`);
  for (const r of repeats) {
    md.push(`- **${r.key}** — ${r.count}×`);
    for (const ex of r.examples) md.push(`  - ${ex}`);
  }
  md.push("");

  md.push(`## By pack`);
  for (const [pack, arr] of Object.entries(groupedByPack)) {
    md.push(`### ${pack} (${arr.length})`);
    for (const c of arr.slice(0, 20)) {
      const link = c.links[0] ? ` — ${c.links[0]}` : "";
      md.push(`- ${c.title} *(conf ${c.confidence.toFixed(2)})*${link}`);
    }
    if (arr.length > 20) md.push(`- …(+${arr.length - 20} more)`);
    md.push("");
  }

  md.push(`## What to implement next (draft)`);
  for (const c of packCandidates.slice(0, 3)) {
    md.push(`- Candidate Pack: **${c.pack}** — собрать Pack-spec и оценить текущий статус в Tele•Ga Canon.`);
  }
  md.push("");

  const jsonFile = `digest_weekly_${stamp}_${digestId}.json`;
  const mdFile = `digest_weekly_${stamp}_${digestId}.md`;

  fs.writeFileSync(path.join(p.digests, jsonFile), JSON.stringify(digestJson, null, 2), "utf8");
  fs.writeFileSync(path.join(p.digests, mdFile), md.join("\n"), "utf8");

  return { digestId, digestJsonFile: jsonFile, digestMdFile: mdFile, totalCards: cards.length, packCandidates };
}
