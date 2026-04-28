// @ts-nocheck
import crypto from "crypto";

function sha1(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

export function fingerprintFromLinks(links: string[]): string | null {
  const norm = (links || [])
    .map((l) => String(l || "").trim().toLowerCase())
    .filter(Boolean)
    .sort();
  if (norm.length === 0) return null;
  return sha1("links:" + norm.join("|")).slice(0, 16);
}

export function fingerprintFromText(text: string): string {
  const t = String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 4000);
  return sha1("text:" + t).slice(0, 16);
}
