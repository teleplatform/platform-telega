// @ts-nocheck
import fs from "fs";

const REQUIRED_HEADERS_IN_ORDER = [
  "# Pack:",
  "## Goal",
  "## Scope (In/Out)",
  "## User Stories",
  "## UX Notes",
  "## API / Data",
  "## Security / Policy",
  "## Tele•Core Contract mapping",
  "## Rollout & Tests",
  "## Acceptance Criteria",
  "## Changelog",
];

export function validatePackSpecFile(absPath: string) {
  if (!fs.existsSync(absPath)) {
    return { ok: false as const, error: `pack_spec_missing: ${absPath}` };
  }

  const raw = fs.readFileSync(absPath, "utf8");
  const text = raw.replace(/\r\n/g, "\n");

  let lastIdx = -1;
  for (const h of REQUIRED_HEADERS_IN_ORDER) {
    const idx = text.indexOf(h);
    if (idx < 0) {
      return { ok: false as const, error: `pack_spec_invalid: missing header "${h}"` };
    }
    if (idx <= lastIdx) {
      return { ok: false as const, error: `pack_spec_invalid: header order broken at "${h}"` };
    }
    lastIdx = idx;
  }

  if (text.length < 400) {
    return { ok: false as const, error: "pack_spec_invalid: too short" };
  }

  return { ok: true as const };
}
