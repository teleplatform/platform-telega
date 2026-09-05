import { CrashInspection, DapStackFrame, DapVariable } from "./dapTypes";
import { getSession, getStackTrace, getScopes, getVariables, evaluateExpression } from "./dapClient";

export async function inspectCrash(sessionId: string): Promise<CrashInspection> {
  const session = getSession(sessionId);
  if (!session) {
    return {
      hasException: false,
      exceptionMessage: "Session not found",
      stackFrames: [],
      topFrameVariables: [],
      suspectedSymbol: null,
      suspectedFile: null,
      recommendedChecks: [],
    };
  }

  const frames = await getStackTrace(sessionId) as DapStackFrame[];
  const topFrame = frames[0];

  let topFrameVariables: DapVariable[] = [];
  if (topFrame) {
    const scopes = await getScopes(sessionId, topFrame.id);
    if (scopes.length > 0) {
      topFrameVariables = await getVariables(sessionId, scopes[0].variablesReference);
    }
  }

  // Try to get exception info via evaluate
  let exceptionMessage: string | null = null;
  try {
    exceptionMessage = await evaluateExpression(sessionId, "$_exception");
  } catch {
    // not available
  }

  // Suspected symbol from top frame name
  const suspectedSymbol = topFrame?.name?.split(".").pop() || null;
  const suspectedFile = topFrame?.file || null;

  const checks: string[] = [];
  if (suspectedFile?.includes(".ts") || suspectedFile?.includes(".js")) {
    checks.push("npm run typecheck");
    checks.push("npm test");
  }
  if (exceptionMessage) {
    checks.push(`Fix: ${exceptionMessage}`);
  }
  checks.push(`Check variables in ${suspectedSymbol || "top frame"}`);

  return {
    hasException: !!exceptionMessage || frames.length > 0,
    exceptionMessage,
    stackFrames: frames.slice(0, 10),
    topFrameVariables: topFrameVariables.slice(0, 20),
    suspectedSymbol,
    suspectedFile,
    recommendedChecks: checks,
  };
}

export async function inspectFrame(
  sessionId: string,
  frameId: number
): Promise<{ frame: DapStackFrame | null; variables: DapVariable[] }> {
  const frames = await getStackTrace(sessionId) as DapStackFrame[];
  const frame = frames.find((f) => f.id === frameId) || frames[frameId] || null;

  let variables: DapVariable[] = [];
  if (frame) {
    const scopes = await getScopes(sessionId, frame.id);
    if (scopes.length > 0) {
      variables = await getVariables(sessionId, scopes[0].variablesReference);
    }
  }

  return { frame, variables };
}

export async function inspectVariable(
  sessionId: string,
  variablesReference: number
): Promise<DapVariable[]> {
  return getVariables(sessionId, variablesReference);
}

export async function inspectExpression(
  sessionId: string,
  expression: string
): Promise<string | null> {
  return evaluateExpression(sessionId, expression);
}
