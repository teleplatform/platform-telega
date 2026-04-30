const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.argv[2] || "packs/voice_lab_skillpack_v1";
const packPath = path.join(ROOT, "pack.json");
const privPath = path.join(ROOT, "keys", "privkey.pem");
const sigPath = path.join(ROOT, "pack.sig");

if (!fs.existsSync(packPath)) throw new Error("pack.json missing");
if (!fs.existsSync(privPath)) throw new Error("privkey.pem missing (run gen_keys.js)");

const pack = JSON.parse(fs.readFileSync(packPath, "utf-8"));
const packId = pack.pack_id;
const ver = pack.version;
const rootHash = pack?.integrity?.root_hash;

if (!packId || !ver || !rootHash) throw new Error("pack_id/version/root_hash missing in pack.json");

const message = `${packId}\n${ver}\n${rootHash}`;
const privPem = fs.readFileSync(privPath, "utf-8");
const privKey = crypto.createPrivateKey(privPem);

const sig = crypto.sign(null, Buffer.from(message, "utf-8"), privKey);
const sigB64 = sig.toString("base64");

fs.writeFileSync(sigPath, sigB64 + "\n", "utf-8");

console.log("SIGNED:", sigPath);
console.log("message:");
console.log(message);
