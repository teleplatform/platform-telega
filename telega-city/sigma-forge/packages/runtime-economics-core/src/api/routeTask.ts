import type { TaskInput } from "../cost/taskComplexity.js";
import type { ExecutionRouteDecision } from "../../runtime-economics-contracts/src/routeDecision.js";
import { routeTaskEconomically } from "../cost/costAwareRouter.js";

export function routeTaskEconomicallyFacade(input: TaskInput, context?: { privacy_sensitive?: boolean }): ExecutionRouteDecision {
  return routeTaskEconomically(input, context);
}
