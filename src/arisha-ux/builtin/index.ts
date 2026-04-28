// ─────────────────────────────────────────────────────────────
// ARISHA UX — Builtin Index
//
// Auto-registers all built-in Arisha UX files on import.
// ─────────────────────────────────────────────────────────────

import { registerUxFile } from "../loader.js";
import { arishaRuUx } from "./ru.js";
import { arishaEnUx } from "./en.js";
import { arishaUzUx } from "./uz.js";

const BUILTIN_UX_FILES = [arishaRuUx, arishaEnUx, arishaUzUx];

for (const file of BUILTIN_UX_FILES) {
  registerUxFile(file);
}

export { arishaRuUx, arishaEnUx, arishaUzUx };
export { BUILTIN_UX_FILES };
