// ─────────────────────────────────────────────────────────────
// MULTILINGUAL LANGUAGE PACK CONTRACT v1.0 — Built-in Index
//
// Auto-registers all built-in language packs on import.
// ─────────────────────────────────────────────────────────────

import { registerPack } from "../loader.js";
import {
  enPack,
  ruPack,
  uzPack,
  dePack,
  frPack,
  esPack,
  jaPack,
} from "./packs.js";

// Register all built-in packs
const BUILTIN_PACKS = [enPack, ruPack, uzPack, dePack, frPack, esPack, jaPack];

for (const pack of BUILTIN_PACKS) {
  registerPack(pack);
}

export { enPack, ruPack, uzPack, dePack, frPack, esPack, jaPack };
export { BUILTIN_PACKS };
