import { AgentProfile, AgentRole, AgentCapability, AgentStatus } from "./agentTypes";

const agents = new Map<string, AgentProfile>();

let counter = 0;
function genId(): string {
  counter++;
  return `agent_${Date.now()}_${counter}`;
}

export const AgentRegistry = {
  register(name: string, role: AgentRole, capabilities: AgentCapability[]): AgentProfile {
    const agent: AgentProfile = {
      id: genId(),
      name,
      role,
      capabilities,
      status: "idle",
      createdAt: Date.now(),
    };
    agents.set(agent.id, agent);
    return agent;
  },

  get(id: string): AgentProfile | undefined {
    return agents.get(id);
  },

  getAll(): AgentProfile[] {
    return Array.from(agents.values());
  },

  listByRole(role: AgentRole): AgentProfile[] {
    return Array.from(agents.values()).filter((a) => a.role === role);
  },

  listAvailable(): AgentProfile[] {
    return Array.from(agents.values()).filter((a) => a.status === "idle");
  },

  updateStatus(id: string, status: AgentStatus): AgentProfile | null {
    const agent = agents.get(id);
    if (!agent) return null;
    const updated = { ...agent, status };
    agents.set(id, updated);
    return updated;
  },

  size(): number {
    return agents.size;
  },

  clear(): void {
    agents.clear();
  },
};
