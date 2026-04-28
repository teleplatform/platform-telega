import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ALG = "aes-256-gcm";

function mustKey(): Buffer {
  const hex = process.env.TELEGPT_WEB_VAULT_KEY_HEX || "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("TELEGPT_WEB_VAULT_KEY_HEX missing_or_invalid (need 64 hex chars)");
  }
  return Buffer.from(hex, "hex");
}

function vaultDir(): string {
  return process.env.TELEGPT_WEB_VAULT_DIR || ".telegpt/vault";
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function vaultPath(name: string) {
  const dir = vaultDir();
  ensureDir(dir);
  return path.join(dir, `${name}.bin`);
}

export function encryptToFile(filePath: string, data: unknown) {
  const key = mustKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);

  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  // [iv|tag|ciphertext]
  const payload = Buffer.concat([iv, tag, enc]);
  fs.writeFileSync(filePath, payload);
}

export function decryptFromFile<T>(filePath: string): T {
  const key = mustKey();
  const payload = fs.readFileSync(filePath);

  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const enc = payload.subarray(28);

  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);

  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(dec.toString("utf8")) as T;
}

export function hasVaultSession(name: string): boolean {
  return fs.existsSync(vaultPath(name));
}
