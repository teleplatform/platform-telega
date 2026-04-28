// ─────────────────────────────────────────────────────────────
// ALICE REQUEST/RESPONSE PROTOCOL ADAPTER v1.0 — Truth Helpers
//
// Protocol validity must never masquerade as runtime success.
// - valid protocol response ≠ runtime execution success
// - end_session=false ≠ session truly alive forever
// - response.text present ≠ delivery/execution truth
// ─────────────────────────────────────────────────────────────

import type { AliceProtocolResponse, AliceProtocolValidationError } from "./types.js";

export function assertProtocolTruth(response: AliceProtocolResponse): string | null {
  // response.text must not be empty
  if (!response.response.text || response.response.text.trim().length === 0) {
    return "Protocol response text must not be empty";
  }

  // end_session must be boolean
  if (typeof response.response.end_session !== "boolean") {
    return "Protocol response end_session must be boolean";
  }

  // session.session_id must be present
  if (!response.session.session_id || response.session.session_id.trim().length === 0) {
    return "Protocol session_id must be present";
  }

  return null;
}

export function buildProtocolTruthSummary(
  outcome: string,
  endSession: boolean,
  sessionId: string,
): string {
  const parts: string[] = [];

  parts.push(`Protocol outcome: ${outcome}`);
  parts.push(`Session end: ${endSession ? "yes" : "no"}`);
  parts.push(`Session ID: ${sessionId}`);

  if (endSession) {
    parts.push("Protocol session will close (not a runtime completion claim)");
  } else {
    parts.push("Protocol session remains open (runtime may continue)");
  }

  return parts.join(". ");
}

export function isProtocolResponseValid(response: AliceProtocolResponse): boolean {
  const errors = validateProtocolResponse(response);
  return errors.length === 0;
}

export function validateProtocolResponse(response: AliceProtocolResponse): AliceProtocolValidationError[] {
  const errors: AliceProtocolValidationError[] = [];

  if (!response.response.text || response.response.text.trim().length === 0) {
    errors.push({ path: "response.text", message: "Must not be empty" });
  }
  if (typeof response.response.end_session !== "boolean") {
    errors.push({ path: "response.end_session", message: "Must be boolean" });
  }
  if (!response.session.session_id || response.session.session_id.trim().length === 0) {
    errors.push({ path: "session.session_id", message: "Must be present" });
  }
  if (!response.version || response.version.trim().length === 0) {
    errors.push({ path: "version", message: "Must be present" });
  }

  return errors;
}
