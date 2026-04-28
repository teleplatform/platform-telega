
// Tool Policy Gate - Pack v1.5 Tool Calls Read-Only

import type {
  ToolCall,
  PolicyResult,
  ToolKind,
  AgentSession,
} from "../../../types/agentRuntime.js";
import { DEFAULT_LIMITS, type RuntimeLimits } from "./runtimeLimits.js";
import { tracePolicyChecked, tracePolicyDenied } from "./policyTrace.js";

type ToolBudgetState = {
  net_fetch_calls: number;
  fs_read_calls: number;
};

const budgetBySid = new Map<string, ToolBudgetState>();

function getBudgetState(sid: string): ToolBudgetState {
  let st = budgetBySid.get(sid);
  if (!st) {
    st = { net_fetch_calls: 0, fs_read_calls: 0 };
    budgetBySid.set(sid, st);
  }
  return st;
}

export interface PolicyGate {
  checkToolExecution(session: AgentSession, tool: ToolCall): Promise<PolicyResult>;
  checkToolArguments(session: AgentSession, tool: ToolCall): Promise<PolicyResult>;
  guardNetFetch?(trace: any, sid: string, url: string): void;
  guardFsRead?(trace: any, sid: string, path: string): void;
  accountNetFetch?(sid: string): void;
  accountFsRead?(sid: string): void;
}

export class ToolPolicyGate implements PolicyGate {
  private netFetchAllowlist: Set<string>;
  private fsReadAllowedDirs: Set<string>;
  private fsReadForbiddenDirs: Set<string>;
  private limits: RuntimeLimits;

  constructor(config: {
    netFetchAllowlist?: string[];
    fsReadAllowedDirs?: string[];
    fsReadForbiddenDirs?: string[];
    limits?: RuntimeLimits;
  }) {
    this.netFetchAllowlist = new Set(config.netFetchAllowlist || []);
    this.fsReadAllowedDirs = new Set(config.fsReadAllowedDirs || []);
    this.fsReadForbiddenDirs = new Set(config.fsReadForbiddenDirs || []);
    this.limits = config.limits || DEFAULT_LIMITS;
  }

  async checkToolExecution(
    session: AgentSession,
    tool: ToolCall
  ): Promise<PolicyResult> {
    // Check if tool is in session's allowed tools
    if (!session.tools.includes(tool.tool_kind)) {
      return {
        allow: false,
        reason: `Tool ${tool.tool_kind} is not allowed in this session`,
        rule_id: "tool_not_allowed",
        decision: "deny",
      };
    }

    // Tool-specific checks
    switch (tool.tool_kind) {
      case "net.fetch":
        return this.checkNetFetch(tool);
      case "fs.read":
        return this.checkFsRead(tool);
      case "terminal.exec":
        return {
          allow: false,
          reason: "terminal.exec is not allowed in read-only mode",
          rule_id: "tool_write_not_allowed",
          decision: "deny",
        };
      default:
        return {
          allow: false,
          reason: `Unknown tool kind: ${tool.tool_kind}`,
          rule_id: "unknown_tool",
          decision: "deny",
        };
    }
  }

  async checkToolArguments(
    session: AgentSession,
    tool: ToolCall
  ): Promise<PolicyResult> {
    // Tool-specific argument validation
    switch (tool.tool_kind) {
      case "net.fetch":
        return this.checkNetFetchArguments(tool);
      case "fs.read":
        return this.checkFsReadArguments(tool);
      case "terminal.exec":
        return {
          allow: false,
          reason: "terminal.exec is not allowed in read-only mode",
          rule_id: "tool_write_not_allowed",
          decision: "deny",
        };
      default:
        return {
          allow: false,
          reason: `Unknown tool kind: ${tool.tool_kind}`,
          rule_id: "unknown_tool",
          decision: "deny",
        };
    }
  }

  private checkNetFetch(tool: ToolCall): PolicyResult {
    const url = new URL(tool.params.url);
    const domain = url.hostname;

    // Check if domain is in allowlist
    let allowed = false;
    for (const allowedDomain of this.netFetchAllowlist) {
      if (allowedDomain.startsWith("*.")) {
        const suffix = allowedDomain.slice(2);
        if (domain.endsWith(suffix)) {
          allowed = true;
          break;
        }
      } else if (domain === allowedDomain) {
        allowed = true;
        break;
      }
    }

    if (!allowed) {
      return {
        allow: false,
        reason: `Domain ${domain} is not in allowlist`,
        rule_id: "net_fetch_allowlist",
        decision: "deny",
      };
    }

    // Check protocol
    if (url.protocol !== "https:") {
      return {
        allow: false,
        reason: "Only HTTPS protocol is allowed",
        rule_id: "net_fetch_protocol",
        decision: "deny",
      };
    }

    return {
      allow: true,
      reason: "Domain and protocol are allowed",
      rule_id: "net_fetch_allowlist",
      decision: "allow",
    };
  }

  private checkNetFetchArguments(tool: ToolCall): PolicyResult {
    // Check timeout
    const timeout = tool.params.timeout;
    if (timeout && (typeof timeout !== "number" || timeout < 0 || timeout > 60000)) {
      return {
        allow: false,
        reason: "Timeout must be between 0 and 60000ms",
        rule_id: "net_fetch_timeout",
        decision: "deny",
      };
    }

    return {
      allow: true,
      reason: "Arguments are valid",
      rule_id: "net_fetch_arguments",
      decision: "allow",
    };
  }

  private checkFsRead(tool: ToolCall): PolicyResult {
    const path = tool.params.path as string;

    // Check if path is in forbidden directories
    for (const forbiddenDir of this.fsReadForbiddenDirs) {
      if (path.startsWith(forbiddenDir)) {
        return {
          allow: false,
          reason: `Path ${path} is in forbidden directory ${forbiddenDir}`,
          rule_id: "fs_read_forbidden",
          decision: "deny",
        };
      }
    }

    // Check if path is in allowed directories
    let allowed = false;
    for (const allowedDir of this.fsReadAllowedDirs) {
      if (path.startsWith(allowedDir)) {
        allowed = true;
        break;
      }
    }

    if (!allowed) {
      return {
        allow: false,
        reason: `Path ${path} is not in allowed directories`,
        rule_id: "fs_read_sandbox",
        decision: "deny",
      };
    }

    return {
      allow: true,
      reason: "Path is in allowed directory",
      rule_id: "fs_read_sandbox",
      decision: "allow",
    };
  }

  private checkFsReadArguments(tool: ToolCall): PolicyResult {
    // Check max_size
    const maxSize = tool.params.max_size;
    if (maxSize && (typeof maxSize !== "number" || maxSize < 0 || maxSize > 1048576)) {
      return {
        allow: false,
        reason: "max_size must be between 0 and 1048576 bytes (1MB)",
        rule_id: "fs_read_max_size",
        decision: "deny",
      };
    }

    // Check encoding
    const encoding = tool.params.encoding;
    if (encoding && encoding !== "utf-8" && encoding !== "base64") {
      return {
        allow: false,
        reason: "encoding must be either 'utf-8' or 'base64'",
        rule_id: "fs_read_encoding",
        decision: "deny",
      };
    }

    return {
      allow: true,
      reason: "Arguments are valid",
      rule_id: "fs_read_arguments",
      decision: "allow",
    };
  }

  // Tool budget guards
  guardNetFetch(trace: any, sid: string, url: string) {
    tracePolicyChecked(trace, sid, "tool_budget", { tool: "net.fetch", url });

    const st = getBudgetState(sid);

    if (st.net_fetch_calls >= this.limits.max_net_fetch_calls_per_session) {
      tracePolicyDenied(trace, sid, "tool_budget", "max_net_fetch_calls_per_session", {
        used: st.net_fetch_calls,
        limit: this.limits.max_net_fetch_calls_per_session,
      });
      const err = new Error("policy.denied: max_net_fetch_calls_per_session");
      (err as any).code = "POLICY_DENIED";
      throw err;
    }
  }

  accountNetFetch(sid: string) {
    const st = getBudgetState(sid);
    st.net_fetch_calls += 1;
  }

  guardFsRead(trace: any, sid: string, path: string) {
    tracePolicyChecked(trace, sid, "tool_budget", { tool: "fs.read", path });

    const st = getBudgetState(sid);

    if (st.fs_read_calls >= this.limits.max_fs_read_calls_per_session) {
      tracePolicyDenied(trace, sid, "tool_budget", "max_fs_read_calls_per_session", {
        used: st.fs_read_calls,
        limit: this.limits.max_fs_read_calls_per_session,
      });
      const err = new Error("policy.denied: max_fs_read_calls_per_session");
      (err as any).code = "POLICY_DENIED";
      throw err;
    }
  }

  accountFsRead(sid: string) {
    const st = getBudgetState(sid);
    st.fs_read_calls += 1;
  }
}
