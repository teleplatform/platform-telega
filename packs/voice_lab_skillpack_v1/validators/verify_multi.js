const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.argv[2] || "packs/voice_lab_skillpack_v1";
const KEYRING_PATH = process.env.TELEGPT_KEYRING_PATH || "config/trust/keyring.skillpacks.json";
const POLICY_NAME = process.env.TELEGPT_PACK_POLICY || "prod";

const packPath = path.join(ROOT, "pack.json");
const sigsPath = path.join(ROOT, "pack.sigs.json");

function die(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}
function nowMs() { return Date.now(); }
function parseMs(s) { return s ? Date.parse(s) : null; }

if (!fs.existsSync(packPath)) die("pack.json missing");
if (!fs.existsSync(sigsPath)) die("pack.sigs.json missing");
if (!fs.existsSync(KEYRING_PATH)) die(`keyring missing: ${KEYRING_PATH}`);

const pack = JSON.parse(fs.readFileSync(packPath, "utf-8"));
const packId = pack.pack_id;
const ver = pack.version;
const rootHash = pack?.integrity?.root_hash;

if (!packId || !ver || !rootHash) die("pack_id/version/root_hash missing");

const policies = pack?.signing_policies || {};
const policy = policies[POLICY_NAME];
if (!policy) die(`unknown policy: ${POLICY_NAME}`);

if (policy.algo !== "ed25519") die("policy algo must be ed25519");
if (policy.message_v !== "v2") die("policy message_v must be v2");

const requiredRoles = Array.isArray(policy.required_roles) ? policy.required_roles : [];
const threshold = Number(policy.threshold || 0);
if (threshold < 1) die("policy threshold invalid");

const message = `v2\n${packId}\n${ver}\n${rootHash}`;

const keyring = JSON.parse(fs.readFileSync(KEYRING_PATH, "utf-8"));
const keys = Array.isArray(keyring.keys) ? keyring.keys : [];

const sigs = JSON.parse(fs.readFileSync(sigsPath, "utf-8"));
const signatures = Array.isArray(sigs.signatures) ? sigs.signatures : [];

if (sigs.pack_id && sigs.pack_id !== packId) die("pack_id mismatch in pack.sigs.json");
if (sigs.pack_version && sigs.pack_version !== ver) die("pack_version mismatch in pack.sigs.json");
if (sigs.root_hash && sigs.root_hash !== rootHash) die("root_hash mismatch in pack.sigs.json");

const valid = [];
const rolesCovered = new Set();
const keyIdsUsed = new Set();

for (const s of signatures) {
  if (!s || typeof s.key_id !== "string" || typeof s.sig_b64 !== "string") continue;
  const entry = keys.find(k => k.key_id === s.key_id);
  if (!entry) continue;
  if (entry.algo !== "ed25519") continue;
  if (entry.status === "revoked") continue;

  const nb = parseMs(entry.not_before);
  const na = parseMs(entry.not_after);
  const t = nowMs();
  if (nb && t < nb) continue;
  if (na && t > na) continue;

  const pubPem = entry.public_key_pem;
  if (!pubPem || !pubPem.includes("BEGIN PUBLIC KEY")) continue;

  const pubKey = crypto.createPublicKey(pubPem);
  const sig = Buffer.from(s.sig_b64, "base64");
  const ok = crypto.verify(null, Buffer.from(message, "utf-8"), pubKey, sig);
  if (!ok) continue;

  valid.push({ key_id: entry.key_id, role: entry.role || "unknown", status: entry.status });
  rolesCovered.add(entry.role || "unknown");
  keyIdsUsed.add(entry.key_id);
}

if (policy.require_distinct_keys && keyIdsUsed.size < Math.min(threshold, valid.length)) {
  die("distinct key requirement failed");
}
if (valid.length < threshold) die(`threshold not met: have ${valid.length}, need ${threshold}`);

for (const r of requiredRoles) {
  if (!rolesCovered.has(r)) die(`required role missing: ${r}`);
}

console.log("OK: signature policy satisfied");
console.log("policy:", POLICY_NAME);
console.log("valid_sigs:", valid.length);
console.log("roles:", Array.from(rolesCovered).join(", "));
console.log("pack:", packId, ver);
console.log("root_hash:", rootHash);
