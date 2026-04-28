export type GateErrorCode = "POLICY_DENIED" | "RATE_LIMITED" | "QUOTA_EXCEEDED";

export function gateError(code: GateErrorCode, message: string, details?: any) {
  return {
    ok: false,
    error: {
      code,
      message,
      details: details ?? undefined,
    },
  };
}