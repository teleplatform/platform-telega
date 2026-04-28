import { EXPLAIN_MSG, MSG } from "./messages.js";
import type { LeafPaths, PathValue } from "./messages.keypath.types.js";

// Keypath helpers are ONLY for config/DSL. Never import from core runtime.
const ALLOW = process.env.TELEGA_ALLOW_KEYPATH === "1";
if (!ALLOW) {
  throw new Error(
    "messages.keypath.runtime imported without TELEGA_ALLOW_KEYPATH=1. " +
      "Keypath i18n is forbidden in core; use t(MSG....) ref-mode."
  );
}

// Prevent accidental tree-shaking friendliness: side-effect marker
export const __KEYPATH_SIDE_EFFECT__ = "DO_NOT_IMPORT_IN_CORE" as const;
void __KEYPATH_SIDE_EFFECT__;

function getByPath(obj: any, path: string): any {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function tFrom<Dict extends object, P extends LeafPaths<Dict>>(
  dict: Dict,
  path: P,
  ...args: PathValue<Dict, P> extends (...a: infer A) => any ? A : []
): string {
  const v = getByPath(dict, path as string) as any;
  return typeof v === "function" ? v(...args) : String(v);
}

export const tMsg = <P extends LeafPaths<typeof MSG>>(
  path: P,
  ...args: PathValue<typeof MSG, P> extends (...a: infer A) => any ? A : []
) => tFrom(MSG, path, ...(args as any));

export const tExplain = <P extends LeafPaths<typeof EXPLAIN_MSG>>(
  path: P,
  ...args: PathValue<typeof EXPLAIN_MSG, P> extends (...a: infer A) => any ? A : []
) => tFrom(EXPLAIN_MSG, path, ...(args as any));
