import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

export type ToolCapability = 
  | "file_read"
  | "repo_read"
  | "shell_readonly"
  | "evidence_query"
  | "job_query"
  | "provider_health_query";

export interface Tool {
  tool_id: string;
  capability: ToolCapability;
  input_schema: Record<string, string>;
  output_schema: string;
  safety_level: "read_only" | "write_requires_approval";
  owner_only: boolean;
}

export const AVAILABLE_TOOLS: Tool[] = [
  {
    tool_id: "read_project_file",
    capability: "file_read",
    input_schema: { path: "string" },
    output_schema: "string",
    safety_level: "read_only",
    owner_only: false,
  },
  {
    tool_id: "glob_project_files",
    capability: "repo_read",
    input_schema: { glob: "string" },
    output_schema: "string[]",
    safety_level: "read_only",
    owner_only: false,
  },
  {
    tool_id: "grep_project",
    capability: "repo_read",
    input_schema: { pattern: "string" },
    output_schema: "string",
    safety_level: "read_only",
    owner_only: false,
  },
  {
    tool_id: "read_recent_evidence",
    capability: "evidence_query",
    input_schema: { limit: "number?" },
    output_schema: "string",
    safety_level: "read_only",
    owner_only: true,
  },
  {
    tool_id: "read_jobs",
    capability: "job_query",
    input_schema: { status: "string?" },
    output_schema: "string",
    safety_level: "read_only",
    owner_only: true,
  },
  {
    tool_id: "read_provider_health",
    capability: "provider_health_query",
    input_schema: {},
    output_schema: "string",
    safety_level: "read_only",
    owner_only: true,
  },
  {
    tool_id: "shell_readonly",
    capability: "shell_readonly",
    input_schema: { command: "string" },
    output_schema: "string",
    safety_level: "read_only",
    owner_only: true,
  },
];

const PROJECT_ROOT = process.cwd();

const SHELL_ALLOWLIST = [
  "pwd", "ls", "find", "grep", "cat", "sed", "awk",
  "git status", "git diff", "git log", "git show", "git branch",
  "which", "head", "tail", "wc", "sort", "uniq",
];

const BLOCKED_PATTERNS = [
  "rm", "rm -rf", "mv", "cp", "chmod", "chown", "sudo",
  "npm install", "pnpm add", "yarn add",
  "git commit", "git push", "git checkout -b", "git branch -d",
  ">", ">>", "| xargs",
  "curl http", "wget http",
  "chmod", "chown", "kill",
];

function isBlocked(command: string): boolean {
  const lower = command.toLowerCase();
  for (const pattern of BLOCKED_PATTERNS) {
    if (lower.includes(pattern)) return true;
  }
  return false;
}

function isShellAllowed(command: string): boolean {
  for (const allowed of SHELL_ALLOWLIST) {
    if (command.toLowerCase().startsWith(allowed) || command.toLowerCase().includes(" " + allowed)) {
      return true;
    }
  }
  return false;
}

export async function executeTool(
  toolId: string,
  input: Record<string, unknown>,
  isOwner = false
): Promise<{ ok: boolean; output: string; error?: string }> {
  const tool = AVAILABLE_TOOLS.find(t => t.tool_id === toolId);
  
  if (!tool) {
    return { ok: false, output: "", error: `Unknown tool: ${toolId}` };
  }
  
  if (tool.owner_only && !isOwner) {
    return { ok: false, output: "", error: `Owner only tool: ${toolId}` };
  }
  
  try {
    switch (toolId) {
      case "read_project_file": {
        const filePath = input.path as string;
        if (!filePath) return { ok: false, output: "", error: "Missing path" };
        const fullPath = path.join(PROJECT_ROOT, filePath);
        if (!fullPath.startsWith(PROJECT_ROOT)) {
          return { ok: false, output: "", error: "Path outside project" };
        }
        const content = await fs.readFile(fullPath, "utf-8");
        return { ok: true, output: content.slice(0, 5000) };
      }
      
      case "glob_project_files": {
        return { ok: false, output: "", error: "glob_project_files not implemented yet" };
      }
      
      case "grep_project": {
        const pattern = input.pattern as string;
        if (!pattern) return { ok: false, output: "", error: "Missing pattern" };
        try {
          const { stdout } = await execAsync(`grep -r --include="*.ts" --include="*.js" --include="*.json" "${pattern}" . 2>/dev/null | head -20`, { cwd: PROJECT_ROOT, timeout: 10000 });
          return { ok: true, output: stdout.slice(0, 3000) || "No matches" };
        } catch (e: any) {
          return { ok: true, output: "No matches or error" };
        }
      }
      
      case "read_recent_evidence": {
        return { ok: true, output: "Evidence query not implemented yet" };
      }
      
      case "read_jobs": {
        return { ok: true, output: "Job query not implemented yet" };
      }
      
      case "read_provider_health": {
        return { ok: true, output: "Provider health not implemented yet" };
      }
      
      case "shell_readonly": {
        const command = input.command as string;
        if (!command) {
          return { ok: false, output: "", error: "Missing command" };
        }
        if (isBlocked(command)) {
          console.log("[tool] blocked:", command);
          return { ok: false, output: "", error: "Blocked command pattern" };
        }
        if (!isShellAllowed(command)) {
          return { ok: false, output: "", error: "Command not in allowlist" };
        }
        const { stdout, stderr } = await execAsync(command, { cwd: PROJECT_ROOT, timeout: 10000 });
        return { ok: true, output: stdout.slice(0, 5000) || stderr.slice(0, 1000) };
      }
      
      default:
        return { ok: false, output: "", error: `Tool not implemented: ${toolId}` };
    }
  } catch (e: any) {
    console.error("[tool] execution error:", toolId, e?.message);
    return { ok: false, output: "", error: e?.message || "Tool execution failed" };
  }
}

export function listTools(): Tool[] {
  return AVAILABLE_TOOLS;
}

export function formatToolList(): string {
  const lines = ["🔧 Available Tools"];
  for (const tool of AVAILABLE_TOOLS) {
    const owner = tool.owner_only ? " (owner only)" : "";
    lines.push(`- ${tool.tool_id}: ${tool.capability}${owner}`);
  }
  return lines.join("\n");
}