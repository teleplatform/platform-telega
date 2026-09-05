import type { CreatorWebBridgeRequest } from "./creator-web-bridge.types.js";

export interface BridgeValidationResult {
  valid: boolean;
  reason?: string;
}

export class WebBridgeValidator {
  validateRequest(req: CreatorWebBridgeRequest): BridgeValidationResult {
    if (req.runtime_mode !== "creator") {
      return { valid: false, reason: `Creator Web Bridge requires creator mode, got '${req.runtime_mode}'` };
    }

    const allowed = ["openai:web", "qwen:web", "deepseek:web"];
    if (!allowed.includes(req.provider_id)) {
      return { valid: false, reason: `Provider '${req.provider_id}' is not a supported web bridge provider` };
    }

    if (!req.prompt || req.prompt.trim().length === 0) {
      return { valid: false, reason: "Prompt cannot be empty" };
    }

    if (req.options.max_wait_ms < 1000) {
      return { valid: false, reason: "max_wait_ms must be at least 1000" };
    }

    return { valid: true };
  }
}
