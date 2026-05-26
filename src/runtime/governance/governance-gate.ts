import type { Action } from "../execution/execution-types.js";
import type { RiskLevel, GovernanceDecision, SandboxPolicy } from "./governance-types.js";
import { getPolicy } from "./governance-policy.js";

function extractDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url.split("/")[2] || url; }
}

function classifyHttpRisk(action: Action, policy: SandboxPolicy): { risk: RiskLevel; reason: string; policyMatch?: string } {
  const url = String(action.params.url ?? "");
  for (const blocked of policy.blockedHttpDomains) {
    if (blocked.test(url)) {
      return { risk: "critical", reason: `HTTP target matches blocked domain pattern: ${blocked}`, policyMatch: `blockedHttpDomains:${blocked}` };
    }
  }
  const isAllowed = policy.allowedHttpDomains.some(d => url.includes(d));
  if (!isAllowed) {
    return { risk: "high", reason: `HTTP target not in allowed domains: ${extractDomain(url)}`, policyMatch: "allowedHttpDomains" };
  }
  return { risk: "low", reason: `HTTP target is in allowed domains` };
}

function classifyShellRisk(action: Action, policy: SandboxPolicy): { risk: RiskLevel; reason: string; policyMatch?: string } {
  const command = String(action.params.command ?? "");
  for (const pattern of policy.blockedShellPatterns) {
    if (pattern.test(command)) {
      return { risk: "critical", reason: `Shell command matches blocked pattern: ${pattern}`, policyMatch: `blockedShellPatterns:${pattern}` };
    }
  }
  const isAllowed = policy.allowedShellPrefixes.some(p => command.startsWith(p));
  if (!isAllowed) {
    return { risk: "high", reason: `Shell command not in allowed prefixes`, policyMatch: "allowedShellPrefixes" };
  }
  return { risk: "low", reason: `Shell command is in allowed prefixes` };
}

function classifyFileReadRisk(action: Action): { risk: RiskLevel; reason: string; policyMatch?: string } {
  const filePath = String(action.params.path ?? "");
  if (filePath.includes("..")) {
    return { risk: "high", reason: `File read path contains traversal: ${filePath}` };
  }
  if (filePath.startsWith("/etc/") || filePath.startsWith("/var/") || filePath.startsWith(".env")) {
    return { risk: "medium", reason: `File read targets sensitive path: ${filePath}` };
  }
  return { risk: "safe", reason: "File read path is acceptable" };
}

function classifyFileWriteRisk(action: Action, policy: SandboxPolicy): { risk: RiskLevel; reason: string; policyMatch?: string } {
  const filePath = String(action.params.path ?? "");
  for (const pattern of policy.blockedFileWritePatterns) {
    if (pattern.test(filePath)) {
      return { risk: "critical", reason: `File write targets blocked path pattern: ${pattern}`, policyMatch: `blockedFileWritePatterns:${pattern}` };
    }
  }
  const isAllowed = policy.allowedFileWritePrefixes.some(p => filePath.startsWith(p));
  if (!isAllowed) {
    return { risk: "high", reason: `File write path not in allowed prefixes`, policyMatch: "allowedFileWritePrefixes" };
  }
  const content = String(action.params.content ?? "");
  const sizeKb = content.length / 1024;
  if (sizeKb > policy.maxFileWriteKb) {
    return { risk: "medium", reason: `File write exceeds max size: ${Math.round(sizeKb)}kb > ${policy.maxFileWriteKb}kb`, policyMatch: "maxFileWriteKb" };
  }
  return { risk: "low", reason: `File write path is allowed` };
}

function classifyVerifyRisk(): { risk: RiskLevel; reason: string } {
  return { risk: "safe", reason: "Verify action is read-only check" };
}

function classifyCompositeRisk(action: Action): { risk: RiskLevel; reason: string } {
  return { risk: "medium", reason: `Composite action requires review of sub-actions` };
}

function classifyBrowserRisk(action: Action, policy: SandboxPolicy): { risk: RiskLevel; reason: string; policyMatch?: string } {
  if (action.type === "browser_screenshot" || action.type === "browser_wait") {
    return { risk: "safe", reason: `${action.type} is passive` };
  }
  if (action.type === "browser_extract") {
    return { risk: "low", reason: "Extract page content is read-only" };
  }
  if (action.type === "browser_click" || action.type === "browser_type") {
    return { risk: "medium", reason: `${action.type} modifies page state` };
  }
  if (action.type === "browser_navigate") {
    const url = String(action.params.url ?? "");
    for (const blocked of policy.blockedBrowserDomains) {
      if (blocked.test(url)) {
        return { risk: "critical", reason: `Browser navigate to blocked domain: ${blocked}`, policyMatch: `blockedBrowserDomains:${blocked}` };
      }
    }
    const isAllowed = policy.allowedBrowserDomains.some(d => url.includes(d));
    if (!isAllowed) {
      return { risk: "high", reason: `Browser navigate to unknown domain: ${extractDomain(url)}`, policyMatch: "allowedBrowserDomains" };
    }
    return { risk: "low", reason: "Browser navigate to allowed domain" };
  }
  return { risk: "high", reason: `Unknown browser action: ${action.type}` };
}

export function classifyActionRisk(action: Action, policy?: SandboxPolicy): { risk: RiskLevel; reason: string; policyMatch?: string } {
  const p = policy ?? getPolicy();
  switch (action.type) {
    case "http": return classifyHttpRisk(action, p);
    case "shell": return classifyShellRisk(action, p);
    case "file_read": return classifyFileReadRisk(action);
    case "file_write": return classifyFileWriteRisk(action, p);
    case "verify": return classifyVerifyRisk();
    case "composite": return classifyCompositeRisk(action);
    default:
      if (action.type.startsWith("browser_")) return classifyBrowserRisk(action, p);
      return { risk: "high", reason: `Unknown action type: ${action.type}` };
  }
}

function riskToVerdict(risk: RiskLevel, reason: string, policyMatch?: string): GovernanceDecision {
  switch (risk) {
    case "safe":
    case "low":
      return { verdict: "allow", risk, reason, policyMatch, blocked: false };
    case "medium":
      return { verdict: "allow", risk, reason, policyMatch, blocked: false };
    case "high":
      return { verdict: "require_approval", risk, reason, policyMatch, requiresApproval: true, blocked: false };
    case "critical":
      return { verdict: "block", risk, reason, policyMatch, blocked: true };
  }
}

export function checkAction(action: Action): GovernanceDecision {
  const { risk, reason, policyMatch } = classifyActionRisk(action);
  return riskToVerdict(risk, reason, policyMatch);
}
