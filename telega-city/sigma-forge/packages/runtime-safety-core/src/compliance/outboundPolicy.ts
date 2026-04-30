import type { SensitivityLevel } from "../../runtime-safety-contracts/src/compliance.js";

export interface OutboundPolicy {
  allow_external_model: boolean;
  allow_local_only: boolean;
  allow_tool_calls: boolean;
}

export function resolveOutboundPolicy(sensitivity: SensitivityLevel, context?: { target: "provider" | "tool" | "channel" | "storage" }): OutboundPolicy {
  switch (sensitivity) {
    case "public_safe":
      return { allow_external_model: true, allow_local_only: false, allow_tool_calls: true };
    case "internal_safe":
      return { allow_external_model: true, allow_local_only: false, allow_tool_calls: true };
    case "provider_restricted":
      return { allow_external_model: true, allow_local_only: false, allow_tool_calls: true };
    case "confidential":
      return { allow_external_model: false, allow_local_only: true, allow_tool_calls: context?.target === "tool" };
    case "regulated":
      return { allow_external_model: false, allow_local_only: true, allow_tool_calls: false };
    default:
      return { allow_external_model: false, allow_local_only: true, allow_tool_calls: false };
  }
}
