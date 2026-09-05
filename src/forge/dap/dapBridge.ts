import {
  DapRequest, DapResult, DapStackFrame, DapScope, DapVariable, DapBreakpoint,
} from "./dapTypes";
import {
  startDebugSession, setBreakpoint, continueExecution,
  getStackTrace, getScopes, getVariables, evaluateExpression, stopDebugSession, getSession,
} from "./dapClient";

export async function handleDapRequest(request: DapRequest): Promise<DapResult> {
  try {
    switch (request.kind) {
      case "launch": {
        if (!request.launchConfig) {
          return { ok: false, kind: request.kind, error: "launchConfig required" };
        }
        const session = await startDebugSession(request.launchConfig);
        return {
          ok: session.status === "running" || session.status === "starting",
          kind: request.kind,
          sessionId: session.id,
        };
      }

      case "breakpoint": {
        if (!request.sessionId || !request.file || request.line === undefined) {
          return { ok: false, kind: request.kind, error: "sessionId, file, and line required" };
        }
        const bp = await setBreakpoint(request.sessionId, request.file, request.line);
        return {
          ok: !!bp,
          kind: request.kind,
          sessionId: request.sessionId,
          breakpoints: bp ? [bp] : [],
        };
      }

      case "continue": {
        if (!request.sessionId) {
          return { ok: false, kind: request.kind, error: "sessionId required" };
        }
        const ok = await continueExecution(request.sessionId);
        return { ok, kind: request.kind, sessionId: request.sessionId };
      }

      case "stack": {
        if (!request.sessionId) {
          return { ok: false, kind: request.kind, error: "sessionId required" };
        }
        const frames = await getStackTrace(request.sessionId);
        return {
          ok: true,
          kind: request.kind,
          sessionId: request.sessionId,
          frames: frames.map((f: any) => ({
            id: f.id,
            name: f.name,
            file: f.source?.path || "",
            line: f.line,
            column: f.column,
          } as DapStackFrame)),
        };
      }

      case "scopes": {
        if (!request.sessionId || request.frameId === undefined) {
          return { ok: false, kind: request.kind, error: "sessionId and frameId required" };
        }
        const scopes = await getScopes(request.sessionId, request.frameId);
        return {
          ok: true,
          kind: request.kind,
          sessionId: request.sessionId,
          scopes: scopes.map((s: any) => ({
            name: s.name,
            variablesReference: s.variablesReference,
            expensive: s.expensive,
          } as DapScope)),
        };
      }

      case "variables": {
        if (!request.sessionId || request.variablesReference === undefined) {
          return { ok: false, kind: request.kind, error: "sessionId and variablesReference required" };
        }
        const variables = await getVariables(request.sessionId, request.variablesReference);
        return {
          ok: true,
          kind: request.kind,
          sessionId: request.sessionId,
          variables: variables.map((v: any) => ({
            name: v.name,
            value: v.value || v.evaluateName || "",
            type: v.type || "",
            variablesReference: v.variablesReference || 0,
          } as DapVariable)),
        };
      }

      case "evaluate": {
        if (!request.sessionId || !request.expression) {
          return { ok: false, kind: request.kind, error: "sessionId and expression required" };
        }
        const result = await evaluateExpression(request.sessionId, request.expression);
        return {
          ok: result !== null,
          kind: request.kind,
          sessionId: request.sessionId,
          evaluateResult: result || undefined,
        };
      }

      case "stop": {
        if (!request.sessionId) {
          return { ok: false, kind: request.kind, error: "sessionId required" };
        }
        const ok = await stopDebugSession(request.sessionId);
        return { ok, kind: request.kind, sessionId: request.sessionId };
      }

      default:
        return { ok: false, kind: request.kind, error: `Unsupported DAP kind: ${request.kind}` };
    }
  } catch (e: any) {
    return { ok: false, kind: request.kind, error: e.message };
  }
}
