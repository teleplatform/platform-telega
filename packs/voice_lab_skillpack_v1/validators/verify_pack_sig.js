const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.argv[2] || "packs/voice_lab_skillpack_v1";
const packPath = path.join(ROOT, "pack.json");
const sigPath = path.join(ROOT, "pack.sig");

const pubPath = process.env.TELEGPT_PACK_PUBKEY_PEM
  ? process.env.TELEGPT_PACK_PUBKEY_PEM
  : path.join(ROOT, "keys", "pubkey.pem");

if (!fs.existsSync(packPath)) throw new Error("pack.json missing");
if (!fs.existsSync(sigPath)) throw new Error("pack.sig missing");
if (!fs.existsSync(pubPath)) throw new Error("pubkey.pem missing (trust anchor)");

const pack = JSON.parse(fs.readFileSync(packPath, "utf-8"));
const packId = pack.pack_id;
const ver = pack.version;
const rootHash = pack?.integrity?.root_hash;

if (!packId || !ver || !rootHash) throw new Error("pack_id/version/root_hash missing in pack.json");

const message = `${packId}\n${ver}\n${rootHash}`;

const pubPem = fs.readFileSync(pubPath, "utf-8");
const pubKey = crypto.createPublicKey(pubPem);

const sigB64 = fs.readFileSync(sigPath, "utf-8").trim();
const sig = Buffer.from(sigB64, "base64");

const ok = crypto.verify(null, Buffer.from(message, "utf-8"), pubKey, sig);

if (!ok) {
  console.error("FAIL: signature invalid");
  process.exit(1);
}

console.log("OK: signature valid");
console.log("pack_id:", packId);
console.log("version:", ver);
console.log("root_hash:", rootHash);
