/**
 * Boot dispatcher shadow observation from a scratch cwd so the audit store
 * (.data/runtime/audit.jsonl) and dispatcher-6c.json never touch the repo.
 *
 *   SHADOW_SCRATCH_DIR=/tmp/... node --import tsx \
 *     scripts/dispatcher/shadow-observation-boot.ts --repeat 4 --out ...
 *
 * The harness module is loaded dynamically AFTER chdir, so its imports (audit
 * store, dispatcher mode) resolve their store paths against the scratch dir.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";

const scratch = process.env.SHADOW_SCRATCH_DIR;
if (scratch) {
  await fs.mkdir(scratch, { recursive: true });
  await fs.mkdir(path.join(scratch, ".data", "execution-evidence"), { recursive: true });
  await fs.mkdir(path.join(scratch, ".data", "runtime"), { recursive: true });
  process.chdir(scratch);
}

await import("./shadow-observation-run.js");