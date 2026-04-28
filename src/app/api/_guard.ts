import type { AuthContext } from "@/server/voice/types";

export function isMaker(auth: AuthContext) {
  const role = process.env.TELEGPT_MAKER_ROLE_NAME || "maker";
  return auth.roles?.includes(role);
}

export function maxUploadBytes() {
  const mb = Number(process.env.TELEGPT_VOICE_MAX_UPLOAD_MB || 25);
  return mb * 1024 * 1024;
}
