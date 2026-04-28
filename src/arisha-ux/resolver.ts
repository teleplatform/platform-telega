// ─────────────────────────────────────────────────────────────
// ARISHA LANGUAGE UX FILES v1.0 — Resolver
//
// Resolves language + mode + surface into a coherent UX context.
// ─────────────────────────────────────────────────────────────

import type {
  ArishaLanguageUxFile,
  ArishaUxModePack,
  ArishaSupportedLanguage,
} from "./types.js";
import { resolveModePack } from "./persona.js";
import { getSurfaceProfile } from "./surface.js";

export type ArishaResolvedContext = {
  file: ArishaLanguageUxFile;
  modePack: ArishaUxModePack;
  surfaceProfile: ReturnType<typeof getSurfaceProfile>;
  effectiveLanguage: ArishaSupportedLanguage;
  effectiveMode: "creator" | "user" | "neutral";
};

export function resolveArishaContext(
  file: ArishaLanguageUxFile,
  input: {
    mode?: "creator" | "user" | "neutral";
    surface?: keyof ArishaLanguageUxFile["surfaceBehavior"];
  },
): ArishaResolvedContext {
  const effectiveMode = input.mode && file.modeVariants[input.mode]
    ? input.mode
    : "neutral";

  const surface = input.surface ?? "web";
  const surfaceProfile = getSurfaceProfile(file, surface);

  return {
    file,
    modePack: resolveModePack(file, input.mode),
    surfaceProfile,
    effectiveLanguage: file.languageCode,
    effectiveMode,
  };
}
