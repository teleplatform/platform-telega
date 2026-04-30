const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.argv[2] || "packs/voice_lab_skillpack_v1";
const policy = process.env.TELEGPT_PACK_POLICY || "prod";

const must = [
  "pack.json",
  "hashes.sha256",
  "pack.sigs.json",
  "validators/validate_integrity.ts",
  "validators/verify_multi.js"
];

for (const f of must) {
  if (!fs.existsSync(path.join(root, f))) {
    console.error("MISSING", f);
    process.exit(1);
  }
}

let r = spawnSync("node", [path.join(root, "validators/validate_integrity.ts"), root], { stdio: "inherit" });
if (r.status !== 0) process.exit(r.status || 1);

r = spawnSync("node", [path.join(root, "validators/verify_multi.js"), root], {
  stdio: "inherit",
  env: { ...process.env, TELEGPT_PACK_POLICY: policy }
});
if (r.status !== 0) process.exit(r.status || 1);

console.log("OK: pack validated (integrity + signatures)");
console.log("policy:", policy);
