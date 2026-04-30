const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.argv[2] || "packs/voice_lab_skillpack_v1";
const keysDir = path.join(ROOT, "keys");
fs.mkdirSync(keysDir, { recursive: true });

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

const pubPem = publicKey.export({ type: "spki", format: "pem" });
const privPem = privateKey.export({ type: "pkcs8", format: "pem" });

fs.writeFileSync(path.join(keysDir, "pubkey.pem"), pubPem, "utf-8");
fs.writeFileSync(path.join(keysDir, "privkey.pem"), privPem, "utf-8");

console.log("OK: keys generated");
console.log("Public:", path.join(keysDir, "pubkey.pem"));
console.log("Private:", path.join(keysDir, "privkey.pem"));
console.log("IMPORTANT: privkey.pem хранить только у тебя (Maker/Owner), не коммитить.");
