import { getAgent, completeAgentRun, failAgentRun, AgentRun } from "./agent-runtime.js";
import { getUserProfile } from "./user-layer.js";
import { checkUserLimits, canUseProvider, incrementUsage } from "./user-layer.js";
import { checkGlobalLoad, acquireProviderLock, releaseProviderLock } from "./governor.js";
import { writeEvidence, EvidenceRecord } from "./evidence-store.js";
import { writeAudit, computeRiskLevel } from "./audit-gateway.js";

export interface AgentExecuteResult {
  success: boolean;
  output: string;
  stepsExecuted: number;
  toolsUsed: string[];
  providersUsed: string[];
  evidenceId?: string;
  auditId?: string;
  error?: string;
}

export async function executeAgent(
  run: AgentRun,
  message: string
): Promise<AgentExecuteResult> {
  const agent = await getAgent(run.agent_id, run.owner_user_id);
  if (!agent) {
    return { success: false, output: "", stepsExecuted: 0, toolsUsed: [], providersUsed: [], error: "Agent not found" };
  }

  if (agent.status !== "active") {
    return { success: false, output: "", stepsExecuted: 0, toolsUsed: [], providersUsed: [], error: "Agent not active" };
  }

  const user = await getUserProfile(run.owner_user_id);
  if (!user) {
    return { success: false, output: "", stepsExecuted: 0, toolsUsed: [], providersUsed: [], error: "User not found" };
  }

  const limitCheck = checkUserLimits(user);
  if (!limitCheck.allowed) {
    return { success: false, output: "", stepsExecuted: 0, toolsUsed: [], providersUsed: [], error: limitCheck.reason };
  }

  let output = "";
  let stepsExecuted = 0;
  const toolsUsed: string[] = [];
  const providersUsed: string[] = [];
  let evidenceId: string | undefined;
  let auditId: string | undefined;

  try {
    const usedProviders: string[] = [];
    for (const p of agent.allowed_providers) {
      if (canUseProvider(user, p)) {
        usedProviders.push(p);
      }
    }
    providersUsed.push(...usedProviders.slice(0, 2));

    const hasStrategy = !message.startsWith("!");
    if (hasStrategy) {
      const { buildStrategyWithGuardrails, executeStrategy } = await import("./strategy-engine.js");
      
      const guardCheck = await checkGlobalLoad();
      if (!guardCheck.allowed) {
        throw new Error(`Governor: ${guardCheck.reason}`);
      }

      const provider = usedProviders[0] || "qwen_web";
      const lock = await acquireProviderLock(provider);
      try {
        const { strategy, evidence } = await buildStrategyWithGuardrails(message, run.run_id);
        
        if (strategy.steps.length > agent.max_steps_per_run) {
          throw new Error(`Max steps exceeded: ${strategy.steps.length} > ${agent.max_steps_per_run}`);
        }

        const result = await executeStrategy(strategy, message);
        output = result.text;

        const evidenceRecord: EvidenceRecord = {
          id: `ev_${run.run_id}`,
          provider,
          mode: strategy.mode,
          input: message,
          output: result.text,
          latency_ms: result.latency || 0,
          steps: strategy.steps.length,
          timestamp: Date.now(),
          success: Boolean(result.text),
          evidence,
        };

        await writeEvidence(evidenceRecord);
        evidenceId = evidenceRecord.id;
        stepsExecuted = strategy.steps.length;
      } finally {
        await releaseProviderLock(provider, lock);
      }
    } else {
      const cmd = message.slice(1).split(" ")[0];
      if (agent.allowed_tools.includes(cmd) && user.limits.allowTools) {
        toolsUsed.push(cmd);
        output = `[Tool execution simulated: ${cmd}]`;
      } else {
        output = `Tools not allowed or not found: ${cmd}`;
      }
    }

    auditId = `audit_${run.run_id}`;
    await writeAudit(
      run.run_id,
      run.owner_user_id,
      user.role,
      "agent_execution",
      message,
      `Agent: ${agent.name} (${agent.mode}), steps: ${stepsExecuted}, providers: ${providersUsed.join(", ")}`,
      "passed",
      output ? "success" : "failed",
      {
        agentId: agent.agent_id,
        agentMode: agent.mode,
        stepsExecuted,
        toolsUsed,
        providersUsed,
        riskLevel: computeRiskLevel("strategy", providersUsed),
      }
    );

    await incrementUsage(run.owner_user_id, true);

    return {
      success: true,
      output,
      stepsExecuted,
      toolsUsed,
      providersUsed,
      evidenceId,
      auditId,
    };
  } catch (e: any) {
    const errorMsg = e?.message || String(e);
    console.error("[agent-executor] failed", errorMsg);

    auditId = `audit_${run.run_id}`;
    await writeAudit(
      run.run_id,
      run.owner_user_id,
      user.role,
      "agent_execution",
      message,
      `Agent: ${agent.name}, error: ${errorMsg}`,
      "failed",
      "failed",
      { agentId: agent.agent_id, error: errorMsg, riskLevel: "high" }
    );

    await failAgentRun(run.run_id, errorMsg);

    return {
      success: false,
      output: "",
      stepsExecuted,
      toolsUsed,
      providersUsed,
      evidenceId,
      auditId,
      error: errorMsg,
    };
  }
}

export async function executeAgentWithJob(
  agentId: string,
  ownerUserId: string,
  message: string
): Promise<string> {
  const { startAgentRun, completeAgentRun: completeRun } = await import("./agent-runtime.js");
  
  const run = await startAgentRun(agentId, message);
  
  const result = await executeAgent(run, message);
  
  await completeRun(
    run.run_id,
    result.output,
    result.stepsExecuted,
    result.toolsUsed,
    result.providersUsed,
    result.evidenceId,
    result.auditId
  );
  
  return result.output;
}