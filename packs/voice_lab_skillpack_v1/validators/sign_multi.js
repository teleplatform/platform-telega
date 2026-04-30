const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.argv[2] || "packs/voice_lab_skillpack_v1";
const KEY_ID = process.argv[3];
const PRIV_PEM_PATH = process.argv[4];

const packPath = path.join(ROOT, "pack.json");
const sigsPath = path.join(ROOT, "pack.sigs.json");

function die(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

if (!KEY_ID) die("missing KEY_ID arg");
if (!PRIV_PEM_PATH) die("missing PRIV_PEM_PATH arg");
if (!fs.existsSync(packPath)) die("pack.json missing");
if (!fs.existsSync(sigsPath)) die("pack.sigs.json missing");
if (!fs.existsSync(PRIV_PEM_PATH)) die("priv pem missing");

const pack = JSON.parse(fs.readFileSync(packPath, "utf-8"));
const packId = pack.pack_id;
const ver = pack.version;
const rootHash = pack?.integrity?.root_hash;
const policy = pack?.signing_policy || {};

if (!packId || !ver || !rootHash) die("pack_id/version/root_hash missing");
if (policy.algo !== "ed25519") die("unsupported algo (expected ed25519)");
if (policy.message_v !== "v2") die("unsupported message_v (expected v2)");

const message = `v2\n${packId}\n${ver}\n${rootHash}`;

const privPem = fs.readFileSync(PRIV_PEM_PATH, "utf-8");
const privKey = crypto.createPrivateKey(privPem);
const sig = crypto.sign(null, Buffer.from(message, "utf-8"), privKey).toString("base64");

const sigs = JSON.parse(fs.readFileSync(sigsPath, "utf-8"));
sigs.pack_id = packId;
sigs.pack_version = ver;
sigs.root_hash = rootHash;
sigs.message_v = "v2";
sigs.signatures = Array.isArray(sigs.signatures) ? sigs.signatures : [];

const existingIdx = sigs.signatures.findIndex((s) => s.key_id === KEY_ID);
const entry = {
  key_id: KEY_ID,
  algo: "ed25519",
  sig_b64: sig,
  signed_at: new Date().toISOString(),
};

if (existingIdx >= 0) sigs.signatures[existingIdx] = entry;
else sigs.signatures.push(entry);

fs.writeFileSync(sigsPath, JSON.stringify(sigs, null, 2) + "\n", "utf-8");

console.log("OK: signed");
console.log("key_id:", KEY_ID);
console.log("pack:", packId, ver);
console.log("root_hash:", rootHash);
