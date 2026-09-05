import type { RuntimeIntent, RuntimeRiskLevel } from "./intent.types.js";
import type { RuntimeSurface } from "../input/runtime-input.types.js";

const DANGEROUS_KEYWORDS = [
  "delete", "remove", "destroy", "erase", "wipe", "reset",
  "rm -rf", "sudo", "chmod 777", "drop table", "drop database",
  "shutdown", "reboot", "kill", "pkill",
  "deploy --prod", "publish --force", "npm publish",
];

const SENSITIVE_KEYWORDS = [
  "password", "token", "secret", "key", "credential", "api_key",
  "access_key", "private", ".env", "ssh",
];

const SURFACE_RISK: Partial<Record<RuntimeSurface, RuntimeRiskLevel>> = {
  voice: "medium",
  browser: "high",
};

export function detectRisk(
  content: string,
  intent: RuntimeIntent,
  surface: RuntimeSurface,
): RuntimeRiskLevel {
  const lower = content.toLowerCase();

  if (intent === "control_runtime") return "medium";
  if (intent === "publish_content") return "high";
  if (intent === "build_project") return "medium";

  for (const kw of DANGEROUS_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) return "critical";
  }

  for (const kw of SENSITIVE_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) return "high";
  }

  const surfaceRisk = SURFACE_RISK[surface];
  if (surfaceRisk) return surfaceRisk;

  return "low";
}
