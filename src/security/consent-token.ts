import crypto from "node:crypto";

export function generateConsentToken(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export function validateConsentToken(token?: string): boolean {
  return Boolean(token);
}
