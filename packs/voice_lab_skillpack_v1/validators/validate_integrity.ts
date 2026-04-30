/* Validate Integrity: verifies hashes.sha256 + pack.json root_hash */
import fs from "fs";
import path from "path";
import crypto from "crypto";

const ROOT = process.argv[2] || "packs/voice_lab_skillpack_v1";
const PACK_JSON = path.join(ROOT, "pack.json");
const HASH_FILE = path.join(ROOT, "hashes.sha256");

function sha256(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function die(msg: string) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(PACK_JSON)) die("pack.json missing");
  if (!fs.existsSync(HASH_FILE)) die("hashes.sha256 missing");

  const pack = JSON.parse(fs.readFileSync(PACK_JSON, "utf-8"));
  const expectedRoot = pack?.integrity?.root_hash;
  if (!expectedRoot || typeof expectedRoot !== "string") {
    die("pack.integrity.root_hash missing");
  }

  const content = fs.readFileSync(HASH_FILE, "utf-8").trim();
  if (!content) die("hashes.sha256 empty");

  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const m = line.match(/^([a-f0-9]{64})\s{2}(.+)$/);
    if (!m) die(`bad line format: ${line}`);
    const h = m[1];
    const r = m[2];
    const fp = path.join(ROOT, r);
    if (!fs.existsSync(fp)) die(`missing file: ${r}`);
    const actual = sha256(fs.readFileSync(fp));
    if (actual !== h) die(`hash mismatch: ${r}`);
  }

  const recomputedRoot = sha256(Buffer.from(lines.join("\n"), "utf-8"));
  if (recomputedRoot !== expectedRoot) {
    die(`root_hash mismatch (expected ${expectedRoot}, got ${recomputedRoot})`);
  }

  console.log("OK: integrity validated");
  console.log("files:", lines.length);
  console.log("root_hash:", recomputedRoot);
}

main();
