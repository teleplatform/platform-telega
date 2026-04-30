/* Seal Pack: generates hashes.sha256 + updates pack.json root_hash */
import fs from "fs";
import path from "path";
import crypto from "crypto";

type PackJson = any;

const ROOT = process.argv[2] || "packs/voice_lab_skillpack_v1";
const PACK_JSON = path.join(ROOT, "pack.json");
const HASH_FILE = path.join(ROOT, "hashes.sha256");

function sha256(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function rel(p: string) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

function readPack(): PackJson {
  if (!fs.existsSync(PACK_JSON)) throw new Error("pack.json missing");
  return JSON.parse(fs.readFileSync(PACK_JSON, "utf-8"));
}

function shouldExclude(r: string) {
  return (
    r === "hashes.sha256" ||
    r.endsWith("/.DS_Store") ||
    r.includes("/node_modules/") ||
    r.endsWith(".map")
  );
}

function main() {
  const pack = readPack();

  const absFiles = walk(ROOT).filter((p) => fs.statSync(p).isFile());
  const files = absFiles
    .map((p) => rel(p))
    .filter((r) => !shouldExclude(r))
    .sort();

  const lines: string[] = [];
  for (const r of files) {
    const b = fs.readFileSync(path.join(ROOT, r));
    lines.push(`${sha256(b)}  ${r}`);
  }
  fs.writeFileSync(HASH_FILE, lines.join("\n") + "\n", "utf-8");

  const rootHash = sha256(Buffer.from(lines.join("\n"), "utf-8"));

  pack.created_at = new Date().toISOString();
  pack.integrity = pack.integrity || {};
  pack.integrity.sealed = true;
  pack.integrity.root_hash = rootHash;

  fs.writeFileSync(PACK_JSON, JSON.stringify(pack, null, 2) + "\n", "utf-8");

  console.log("SEALED:", ROOT);
  console.log("files:", files.length);
  console.log("root_hash:", rootHash);
}

main();
