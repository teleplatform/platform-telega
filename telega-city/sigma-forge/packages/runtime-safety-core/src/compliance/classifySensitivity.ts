import type { SensitivityLevel, RedactionEntry } from "../../runtime-safety-contracts/src/compliance.js";

export function classifySensitivity(payload: unknown, detections: RedactionEntry[]): SensitivityLevel {
  if (detections.length === 0) return "public_safe";

  const kinds = new Set(detections.map((d) => d.kind));

  if (kinds.has("payment") || kinds.has("secret")) return "regulated";
  if (kinds.has("pii") || kinds.has("crm")) return "confidential";
  if (kinds.has("address")) return "provider_restricted";
  return "internal_safe";
}
