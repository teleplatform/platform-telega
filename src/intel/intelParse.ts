// @ts-nocheck
import crypto from "crypto";
import type { IntelCardV1, IntelType } from "./intelTypes";

function norm(s: string) {
  return s.toLowerCase();
}

function guessSource(text: string): string {
  const t = norm(text);
  if (t.includes("ucoz")) return "ucoz";
  if (t.includes("tgshop") || t.includes("tg shop") || t.includes("telegram shop")) return "tgshop";
  if (t.includes("shopsbuilder") || t.includes("shop builder")) return "shopsbuilder";
  return "other";
}

function guessType(text: string): IntelType {
  const t = norm(text);
  if (t.includes("payment") || t.includes("оплат") || t.includes("касс")) return "payments";
  if (t.includes("аналит") || t.includes("analytics") || t.includes("метрик")) return "analytics";
  if (t.includes("seo")) return "seo";
  if (t.includes("ads") || t.includes("реклам")) return "ads";
  if (t.includes("security") || t.includes("безопас") || t.includes("fraud")) return "security";
  if (t.includes("content") || t.includes("контент")) return "content";
  if (t.includes("promo") || t.includes("акци") || t.includes("скидк")) return "promo";
  if (t.includes("update") || t.includes("релиз") || t.includes("обновл")) return "update";
  return "other";
}

function extractLinks(text: string): string[] {
  const out = new Set<string>();
  const re = /(https?:\/\/[^\s)]+|t\.me\/[^\s)]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    if (raw.startsWith("t.me/")) out.add(`https://${raw}`);
    else out.add(raw);
  }
  return Array.from(out);
}

function summarize(text: string): string[] {
  const lines = text
    .split(/\r?\n+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const picked = lines.slice(0, 3).map((s) => (s.length > 180 ? `${s.slice(0, 180)}…` : s));
  return picked;
}

function proposePack(type: IntelType, text: string): string {
  const t = norm(text);
  if (t.includes("variant") || t.includes("вариац") || t.includes("цвет") || t.includes("размер")) {
    return "Catalog/Variants";
  }
  switch (type) {
    case "payments":
      return "Monetization";
    case "analytics":
      return "Analytics";
    case "security":
      return "Guardian";
    case "seo":
      return "Growth/SEO";
    case "ads":
      return "Growth/Ads";
    case "promo":
      return "Growth/Promo";
    case "content":
      return "Content";
    case "update":
      return "Platform/Update";
    default:
      return "Other";
  }
}

function heuristics(card: IntelCardV1) {
  const t = norm(card.raw.text || "");

  // special: content filter / anti-spam
  if (t.includes("контент") && (t.includes("фильтр") || t.includes("антиспам") || t.includes("spam"))) {
    card.title = "Market: Content Filter / Anti-spam";
    card.tele_ga_impact.unshift(
      "КАНОН: Guardian Layer (filters/policies) + per-role policies + трассировка решений (explainable)."
    );
    card.proposed_pack = "Guardian";
    card.confidence = Math.max(card.confidence, 0.9);
  }

  // special: variants
  if (t.includes("вариаци") || (t.includes("цвет") && t.includes("размер"))) {
    card.title = "Market: Variants / Options become expected";
    card.tele_ga_impact.unshift(
      "СИГНАЛ: вариации товара — must-have для каталога (Catalog/Variants)."
    );
    card.proposed_pack = "Catalog/Variants";
    card.confidence = Math.max(card.confidence, 0.85);
  }
}

export function buildIntelCard(input: {
  text: string;
  message_id?: number;
  chat_id?: number | string;
  from?: string;
}): IntelCardV1 {
  const text = (input.text || "").trim();
  const source = guessSource(text);
  const type = guessType(text);
  const links = extractLinks(text);
  const id = crypto.createHash("sha1").update(`${Date.now()}_${text}`).digest("hex").slice(0, 12);

  const card: IntelCardV1 = {
    schema: "PANTHEON_INTEL_CARD_V1",
    id,
    created_at: new Date().toISOString(),
    source,
    type,
    title: `${source.toUpperCase()}: ${type}`,
    summary: summarize(text),
    links,
    signals: [`source=${source}`, `type=${type}`, `links=${links.length}`],
    tele_ga_impact: [
      "Сигнал для Tele•Ga: выделить паттерн и сравнить с нашим Roadmap/Canon.",
      "Если повторяется у нескольких игроков — кандидат в Canon/Packs.",
    ],
    proposed_pack: proposePack(type, text),
    confidence: source === "other" ? 0.68 : 0.82,
    raw: {
      text,
      message_id: input.message_id,
      chat_id: input.chat_id,
      from: input.from,
    },
  };

  heuristics(card);
  return card;
}
