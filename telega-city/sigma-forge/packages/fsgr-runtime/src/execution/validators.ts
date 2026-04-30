import type { ExecutionNode } from "../../fsgr-contracts/src/index.js";

export interface ValidatorOutcome {
  validator: string;
  status: "passed" | "failed" | "warning";
  summary: string;
}

export type ValidatorFn = (node: ExecutionNode, outputs: Record<string, unknown>) => ValidatorOutcome;

export interface ValidatorRegistry {
  register(name: string, fn: ValidatorFn): void;
  get(name: string): ValidatorFn | undefined;
  getAll(): Map<string, ValidatorFn>;
}

export function createValidatorRegistry(): ValidatorRegistry {
  const validators = new Map<string, ValidatorFn>();
  return {
    register(name: string, fn: ValidatorFn): void { validators.set(name, fn); },
    get(name: string): ValidatorFn | undefined { return validators.get(name); },
    getAll(): Map<string, ValidatorFn> { return validators; },
  };
}

export function runValidators(node: ExecutionNode, handlerResult: { outputs: Array<{ ref: string; value: unknown }> }, registry: ValidatorRegistry): ValidatorOutcome[] {
  const results: ValidatorOutcome[] = [];
  const outputValues: Record<string, unknown> = {};
  for (const out of handlerResult.outputs) {
    outputValues[out.ref] = out.value;
  }

  for (const hook of node.validator_hooks) {
    const validator = registry.get(hook);
    if (validator) {
      results.push(validator(node, outputValues));
    }
  }

  return results;
}

export function registerDefaultValidators(registry: ValidatorRegistry): void {
  registry.register("output-exists", (_node, outputs) => {
    const hasOutput = Object.keys(outputs).length > 0;
    return { validator: "output-exists", status: hasOutput ? "passed" : "failed", summary: hasOutput ? "Output exists" : "No output" };
  });

  registry.register("output-non-empty", (_node, outputs) => {
    const values = Object.values(outputs);
    const nonEmpty = values.some((v) => v !== null && v !== undefined && v !== "" && (typeof v !== "object" || Object.keys(v).length > 0));
    return { validator: "output-non-empty", status: nonEmpty ? "passed" : "warning", summary: nonEmpty ? "Output non-empty" : "Output empty" };
  });

  registry.register("output-basic-shape", (_node, outputs) => {
    const hasValidShape = Object.values(outputs).every((v) => v !== null && v !== undefined);
    return { validator: "output-basic-shape", status: hasValidShape ? "passed" : "warning", summary: hasValidShape ? "Basic shape valid" : "Invalid shape" };
  });
}
