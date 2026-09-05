import type { RuntimeIntent } from "./intent.types.js";

const STRIP_PATTERNS: Partial<Record<RuntimeIntent, RegExp[]>> = {
  build_project: [/^(build|create|make|generate|write|implement|develop|new)\s+/i],
  modify_repo: [/^(fix|refactor|change|update|modify|add|remove|edit|implement)\s+/i],
  research: [/^(research|search\s+for|find|explain|investigate|analyze|what\s+is|how\s+(does|to|can|do))\s+/i],
  analyze_file: [/^(analyze|review|check|inspect|explain)\s+/i],
  generate_media: [/^(generate|create|make)\s+(an?\s+)?(image|video|audio|design|icon|logo)/i],
  publish_content: [/^(publish|deploy|release|submit|upload)\s+/i],
  control_runtime: [/^(check|show|get|list)\s+/i],
};

export function extractGoal(content: string, intent: RuntimeIntent): string {
  const patterns = STRIP_PATTERNS[intent];
  if (!patterns) return content;

  let goal = content;
  for (const pattern of patterns) {
    goal = goal.replace(pattern, "").trim();
  }

  if (!goal) return content;
  return goal.charAt(0).toUpperCase() + goal.slice(1);
}
