// Tool Access Matrix — Pack 2.4
// Mode-based tool access rules

import type {
  ActorMode,
  ToolAccessRule,
  ToolAccessDecision,
} from "../../types/authz.js";

export const DEFAULT_TOOL_RULES: ToolAccessRule[] = [
  {
    tool_id: "fs.read",
    allowed_modes: ["creator", "internal", "system"],
  },
  {
    tool_id: "net.fetch",
    allowed_modes: ["creator", "internal", "system"],
  },
  {
    tool_id: "terminal.exec",
    allowed_modes: ["internal", "system"],
  },
  {
    tool_id: "media.generate",
    allowed_modes: ["creator", "internal", "system"],
  },
  {
    tool_id: "forge.run",
    allowed_modes: ["creator", "internal", "system"],
  },
  {
    tool_id: "research.run",
    allowed_modes: ["creator", "internal", "system"],
  },
  {
    tool_id: "tool.proxy",
    allowed_modes: ["creator", "internal", "system"],
  },
];

export function checkToolAccess(
  toolId: string,
  mode: ActorMode,
  rules: ToolAccessRule[] = DEFAULT_TOOL_RULES
): ToolAccessDecision {
  const rule = rules.find((r) => r.tool_id === toolId);

  if (!rule) {
    return {
      allowed: false,
      tool_id: toolId,
      reason: `unknown_tool:${toolId}`,
    };
  }

  if (!rule.allowed_modes.includes(mode)) {
    return {
      allowed: false,
      tool_id: toolId,
      reason: `mode_not_allowed:${mode} for tool:${toolId}`,
    };
  }

  return {
    allowed: true,
    tool_id: toolId,
    reason: "allowed",
  };
}

export function getAvailableTools(mode: ActorMode): ToolAccessRule[] {
  return DEFAULT_TOOL_RULES.filter((r) => r.allowed_modes.includes(mode));
}
