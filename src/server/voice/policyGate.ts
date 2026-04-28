import { AuthContext } from "./types";

export function requireMaker(auth: AuthContext): { ok: true } | { ok: false; reason: string } {
  const makerRole = process.env.TELEGPT_MAKER_ROLE_NAME || "maker";
  if (!auth.roles?.includes(makerRole)) {
    return { ok: false, reason: "maker_required" };
  }
  return { ok: true };
}

export function requireConsent(declared: boolean): { ok: true } | { ok: false; reason: string } {
  if (!declared) return { ok: false, reason: "consent_required" };
  return { ok: true };
}
