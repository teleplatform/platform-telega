export type DispatchErrorCode =
  | "DISPATCH_INVALID_REQUEST"
  | "CAPABILITY_NOT_FOUND"
  | "CAPABILITY_AMBIGUOUS"
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "APPROVAL_REQUIRED"
  | "TARGET_OFFLINE"
  | "TARGET_DEGRADED"
  | "NO_EXECUTION_BINDING"
  | "PROVIDER_SELECTION_FAILED";

export class DispatchError extends Error {
  readonly code: DispatchErrorCode;
  readonly diagnostics?: Record<string, unknown>;

  constructor(code: DispatchErrorCode, message: string, diagnostics?: Record<string, unknown>) {
    super(message);
    this.name = "DispatchError";
    this.code = code;
    this.diagnostics = diagnostics;
  }
}
