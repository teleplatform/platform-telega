export type PublicAllowedCommand =
  | "/start"
  | "/help"
  | "/new"
  | "/history"
  | "/settings";

export const PUBLIC_ALLOWED_COMMANDS: ReadonlySet<string> = new Set([
  "/start",
  "/help",
  "/new",
  "/history",
  "/settings",
]);

export interface PublicSurfacePolicyResult {
  allowed: boolean;
  reason: string;
  sanitized_response?: string;
}

export const PUBLIC_BLOCK_MESSAGE = "❌ Эта команда недоступна.";

export const TELEGPT_DISPLAY = "TeleGPT";
export const TELEGPT_FULL = "TeleGPT (Москвич 412)";

export interface PublicSanitizationRule {
  pattern: RegExp;
  replacement: string;
}

export const PUBLIC_PROVIDER_NAME_MAP: Record<string, string> = {
  "openai": "",
  "qwen": "",
  "deepseek": "",
  "gemini": "",
  "claude": "",
  ":web": "",
  ":api": "",
  "local": "",
  "creator_web": "",
  "api_model": "",
  "local_model": "",
};

export const PUBLIC_SANITIZATION_RULES: PublicSanitizationRule[] = [
  // Provider names — completely stripped
  { pattern: /openai[: ]?(web|api)?/gi, replacement: "" },
  { pattern: /qwen[: ]?(web|api)?/gi, replacement: "" },
  { pattern: /deepseek[: ]?(web|api)?/gi, replacement: "" },
  { pattern: /\bgemini\b/gi, replacement: "" },
  { pattern: /\bclaude\b/gi, replacement: "" },

  // Model identifiers
  { pattern: /\bgpt[-\s]?4[ou]?\b/gi, replacement: "" },
  { pattern: /\bgpt[-\s]?4\b/gi, replacement: "" },
  { pattern: /\bgpt[-\s]?3[.]?5\b/gi, replacement: "" },
  { pattern: /\bgpt[-\s]?\d+\b/gi, replacement: "" },
  { pattern: /\bclaude[-\s]?(3|4|sonnet|opus|haiku)\b/gi, replacement: "" },
  { pattern: /\bdeepseek[-\s]?(v2|v3|r1|chat|reasoner)\b/gi, replacement: "" },
  { pattern: /\bqwen[-\s]?(2|2.5|72b|plus|turbo)\b/gi, replacement: "" },

  // Access tier names
  { pattern: /creator_web/gi, replacement: "" },
  { pattern: /api_model/gi, replacement: "" },
  { pattern: /local_model/gi, replacement: "" },
  { pattern: /provider_access_tier/gi, replacement: "" },

  // Infrastructure terms
  { pattern: /Web Bridge|[Ww]eb [Bb]ridge/gi, replacement: "" },
  { pattern: /Browser Profile|browser profile/gi, replacement: "" },
  { pattern: /ws_endpoint/gi, replacement: "" },
  { pattern: /runtime_mode/gi, replacement: "" },

  // Orchestration and kernel terms
  { pattern: /Runtime Control|RuntimeControl/gi, replacement: "" },
  { pattern: /State [Ff]abric|state fabric/gi, replacement: "" },
  { pattern: /Event [Rr]eplay|event replay/gi, replacement: "" },
  { pattern: /Smoke [Tt]est|smoke test|smoke_test/gi, replacement: "" },
  { pattern: /Live Validation|live validation|live_validate/gi, replacement: "" },
  { pattern: /Orchestration[ Kk]ernel|orchestration kernel/gi, replacement: "" },
  { pattern: /\bdispatch\b/gi, replacement: "" },
  { pattern: /\brouter\b/gi, replacement: "" },
  { pattern: /\bgovernance\b/gi, replacement: "" },
  { pattern: /\bfallback\b/gi, replacement: "" },
  { pattern: /\bRelay\b/gi, replacement: "" },

  // Generic technical terms (after specific ones to avoid double-match)
  { pattern: /\bprovider\b/gi, replacement: "" },
  { pattern: /\bbridge\b/gi, replacement: "" },
  { pattern: /\bruntime\b/gi, replacement: "" },
  { pattern: /\btier\b/gi, replacement: "" },
  { pattern: /\bmodel\b/gi, replacement: "" },

  // Markdown command references
  { pattern: /`\/\w+`/g, replacement: "" },

  // Evidence and trace identifiers
  { pattern: /evidence_id[^,]*/gi, replacement: "" },
  { pattern: /trace_id[^,]*/gi, replacement: "" },
  { pattern: /session_id[^,]*/gi, replacement: "" },
];
