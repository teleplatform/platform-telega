import type { SkillUnit } from "../../fsgr-contracts/src/index.js";

export interface ExecutionHandlerContext {
  run_id: string;
  node_id: string;
  skill_id: string;
  actor_mode?: string;
  input_refs: string[];
  trace_id?: string;
}

export interface ExecutionHandlerResult {
  outputs: Array<{
    ref: string;
    kind: "json" | "doc" | "code" | "report" | "bundle";
    value: unknown;
  }>;
  summary?: string;
}

export type ExecutionHandler = (context: ExecutionHandlerContext) => Promise<ExecutionHandlerResult>;

export interface ExecutionHandlerRegistry {
  register(skill_id: string, handler: ExecutionHandler): void;
  get(skill_id: string): ExecutionHandler | undefined;
}

export function createExecutionHandlerRegistry(defaultHandler: ExecutionHandler): ExecutionHandlerRegistry {
  const handlers = new Map<string, ExecutionHandler>();
  return {
    register(skill_id: string, handler: ExecutionHandler): void {
      handlers.set(skill_id, handler);
    },
    get(skill_id: string): ExecutionHandler | undefined {
      return handlers.get(skill_id) ?? defaultHandler;
    },
  };
}

export function createDefaultExecutionHandler(): ExecutionHandler {
  return async (context: ExecutionHandlerContext): Promise<ExecutionHandlerResult> => {
    return {
      outputs: [{
        ref: `${context.node_id}_output`,
        kind: "json",
        value: { skill_id: context.skill_id, status: "executed", node_id: context.node_id },
      }],
      summary: `Executed ${context.skill_id}`,
    };
  };
}
