import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const root = process.argv[2] || "packs/voice_lab_skillpack_v1";

const must = [
  "pack.json",
  "hashes.sha256",
  "sql/VOICE_CORE_V1.sql",
  "README.md",
  "validators/seal_pack.ts",
  "validators/validate_integrity.ts",
  "validators/validate_pack.ts",
  "validators/validate_pack.js",
  "validators/verify_multi.js",
  "telegpt/api/voice/register.route.ts",
  "telegpt/api/voice/speak.route.ts",
  "telegpt/api/voice/convert.route.ts",
  "telegpt/api/voice/dialogue.route.ts",
  "telegpt/api/voice/me.route.ts",
  "telegpt/api/voice/rename.route.ts",
  "telegpt/api/voice/delete.route.ts",
  "telegpt/ui/voice.page.tsx",
  "telegpt/ui/components/VoiceDialoguePanel.tsx",
  "telegpt/ui/components/VoiceConvertPanel.tsx",
  "telegpt/ui/components/VoiceRenameInline.tsx"
];

let ok = true;
for (const f of must) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) {
    console.error("MISSING", f);
    ok = false;
  }
}
if (!ok) process.exit(1);

const r = spawnSync("node", [path.join(root, "validators/validate_integrity.ts"), root], { stdio: "inherit" });
if (r.status !== 0) process.exit(r.status || 1);

const r2 = spawnSync(\"node\", [path.join(root, \"validators/verify_multi.js\"), root], { stdio: \"inherit\", env: process.env });\nif (r2.status !== 0) process.exit(r2.status || 1);

console.log("OK: Voice Lab SkillPack v1");
