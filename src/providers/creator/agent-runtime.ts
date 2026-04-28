import fs from "fs/promises";
import path from "path";

const AGENTS_DIR = path.join(process.cwd(), "data", "creator-bridge");
const AGENTS_FILE = path.join(AGENTS_DIR, "agents.jsonl");
const AGENT_RUNS_FILE = path.join(AGENTS_DIR, "agent-runs.jsonl");

export type AgentMode = "research" | "monitor" | "coding_assistant" | "content" | "ops";
export type AgentStatus = "active" | "paused" | "disabled";

export interface Agent {
  agent_id: string;
  owner_user_id: string;
  name: string;
  purpose: string;
  mode: AgentMode;
  allowed_tools: string[];
  allowed_providers: string[];
  schedule?: string;
  status: AgentStatus;
  max_steps_per_run: number;
  max_runs_per_day: number;
  created_at: number;
  updated_at: number;
}

export interface AgentRun {
  run_id: string;
  agent_id: string;
  owner_user_id: string;
  started_at: number;
  completed_at?: number;
  status: "running" | "completed" | "failed" | "cancelled";
  input: string;
  output?: string;
  steps_executed: number;
  tools_used: string[];
  providers_used: string[];
  evidence_id?: string;
  audit_id?: string;
  error?: string;
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(AGENTS_DIR, { recursive: true });
  } catch {}
}

function makeId(): string {
  return `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function appendAgent(agent: Agent): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(agent) + "\n";
    await fs.appendFile(AGENTS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[agents] write failed", e);
  }
}

export async function appendAgentRun(run: AgentRun): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(run) + "\n";
    await fs.appendFile(AGENT_RUNS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[agents] run write failed", e);
  }
}

export async function loadAgents(): Promise<Agent[]> {
  const agents: Agent[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(AGENTS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.agent_id) {
          agents.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return agents;
}

export async function loadAgentRuns(agentId?: string): Promise<AgentRun[]> {
  const runs: AgentRun[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(AGENT_RUNS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.run_id) {
          if (!agentId || parsed.agent_id === agentId) {
            runs.push(parsed);
          }
        }
      } catch {}
    }
  } catch {}
  return runs.sort((a, b) => b.started_at - a.started_at);
}

export async function createAgent(
  ownerUserId: string,
  name: string,
  purpose: string,
  mode: AgentMode,
  allowedTools: string[] = [],
  allowedProviders: string[] = [],
  maxStepsPerRun = 5,
  maxRunsPerDay = 10
): Promise<Agent> {
  const agent: Agent = {
    agent_id: makeId(),
    owner_user_id: ownerUserId,
    name,
    purpose,
    mode,
    allowed_tools: allowedTools,
    allowed_providers: allowedProviders,
    status: "active",
    max_steps_per_run: maxStepsPerRun,
    max_runs_per_day: maxRunsPerDay,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  await appendAgent(agent);
  return agent;
}

export async function getAgent(agentId: string, ownerUserId?: string): Promise<Agent | null> {
  const agents = await loadAgents();
  const agent = agents.find(a => a.agent_id === agentId);
  if (!agent) return null;
  if (ownerUserId && agent.owner_user_id !== ownerUserId) return null;
  return agent;
}

export async function getUserAgents(userId: string): Promise<Agent[]> {
  const agents = await loadAgents();
  return agents.filter(a => a.owner_user_id === userId);
}

export async function getAllAgents(): Promise<Agent[]> {
  return loadAgents();
}

export async function updateAgentStatus(agentId: string, status: AgentStatus, ownerUserId?: string): Promise<boolean> {
  const agents = await loadAgents();
  const idx = agents.findIndex(a => a.agent_id === agentId);
  if (idx === -1) return false;
  if (ownerUserId && agents[idx].owner_user_id !== ownerUserId) return false;
  agents[idx].status = status;
  agents[idx].updated_at = Date.now();
  await appendAgent(agents[idx]);
  return true;
}

export async function checkAgentRunLimit(agentId: string): Promise<{ allowed: boolean; reason?: string }> {
  const runs = await loadAgentRuns(agentId);
  const agent = await getAgent(agentId);
  if (!agent) return { allowed: false, reason: "agent_not_found" };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayRuns = runs.filter(r => r.started_at >= today.getTime() && r.status !== "cancelled");
  
  if (todayRuns.length >= agent.max_runs_per_day) {
    return { allowed: false, reason: "daily_run_limit_reached" };
  }
  
  return { allowed: true };
}

export async function startAgentRun(agentId: string, input: string): Promise<AgentRun> {
  const agent = await getAgent(agentId);
  if (!agent) throw new Error("Agent not found");
  if (agent.status !== "active") throw new Error("Agent is not active");
  
  const limitCheck = await checkAgentRunLimit(agentId);
  if (!limitCheck.allowed) throw new Error(limitCheck.reason);
  
  const run: AgentRun = {
    run_id: makeRunId(),
    agent_id: agentId,
    owner_user_id: agent.owner_user_id,
    started_at: Date.now(),
    status: "running",
    input,
    steps_executed: 0,
    tools_used: [],
    providers_used: [],
  };
  
  await appendAgentRun(run);
  return run;
}

export async function completeAgentRun(
  runId: string,
  output: string,
  stepsExecuted: number,
  toolsUsed: string[],
  providersUsed: string[],
  evidenceId?: string,
  auditId?: string
): Promise<void> {
  const runs = await loadAgentRuns();
  const run = runs.find(r => r.run_id === runId);
  if (!run) return;
  
  run.completed_at = Date.now();
  run.status = "completed";
  run.output = output;
  run.steps_executed = stepsExecuted;
  run.tools_used = toolsUsed;
  run.providers_used = providersUsed;
  run.evidence_id = evidenceId;
  run.audit_id = auditId;
  
  await appendAgentRun(run);
}

export async function failAgentRun(runId: string, error: string): Promise<void> {
  const runs = await loadAgentRuns();
  const run = runs.find(r => r.run_id === runId);
  if (!run) return;
  
  run.completed_at = Date.now();
  run.status = "failed";
  run.error = error;
  
  await appendAgentRun(run);
}

export function formatAgentList(agents: Agent[]): string {
  if (agents.length === 0) return "No agents found";
  
  const lines = agents.map(a => {
    const statusIcon = a.status === "active" ? "🟢" : a.status === "paused" ? "🟡" : "🔴";
    return `${statusIcon} ${a.name} (${a.mode})\nID: ${a.agent_id}\nPurpose: ${a.purpose}\n`;
  });
  
  return lines.join("\n");
}

export function formatAgent(agent: Agent): string {
  const runs = loadAgentRuns(agent.agent_id);
  
  return `🤖 Agent: ${agent.name}
ID: ${agent.agent_id}
Mode: ${agent.mode}
Status: ${agent.status}
Purpose: ${agent.purpose}

Tools: ${agent.allowed_tools.join(", ") || "none"}
Providers: ${agent.allowed_providers.join(", ") || "default"}

Max steps/run: ${agent.max_steps_per_run}
Max runs/day: ${agent.max_runs_per_day}

Created: ${new Date(agent.created_at).toISOString()}
Updated: ${new Date(agent.updated_at).toISOString()}`;
}

export function formatAgentRuns(runs: AgentRun[]): string {
  if (runs.length === 0) return "No runs found";
  
  const lines = runs.slice(0, 10).map(r => {
    const icon = r.status === "completed" ? "✅" : r.status === "failed" ? "❌" : r.status === "running" ? "🔄" : "⚪";
    const date = new Date(r.started_at).toLocaleString();
    return `${icon} ${date}\nInput: ${r.input.slice(0, 50)}${r.input.length > 50 ? "..." : ""}\nSteps: ${r.steps_executed}\n`;
  });
  
  return lines.join("\n");
}

export function getDefaultToolsForMode(mode: AgentMode): string[] {
  switch (mode) {
    case "research":
      return ["web_search", "web_fetch", "grep"];
    case "monitor":
      return ["health_check", "metrics"];
    case "coding_assistant":
      return ["grep", "shell_readonly", "file_read"];
    case "content":
      return ["web_fetch", "web_search"];
    case "ops":
      return ["shell_readonly", "file_read", "grep"];
    default:
      return [];
  }
}

export function getDefaultProvidersForMode(mode: AgentMode): string[] {
  switch (mode) {
    case "research":
      return ["perplexity_web", "deepseek_web"];
    case "monitor":
      return ["qwen_web"];
    case "coding_assistant":
      return ["grok_web", "claude_web", "gemini_web"];
    case "content":
      return ["chatgpt_web", "kimi_web"];
    case "ops":
      return ["qwen_web", "deepseek_web"];
    default:
      return ["qwen_web"];
  }
}