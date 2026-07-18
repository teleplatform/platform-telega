import { randomBytes, createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface TeleGptApiKey {
  id: string;
  prefix: string;
  secretHash: string;
  name: string;
  clientType: "opencode" | "sigma_forge" | "external";
  allowedModels: string[];
  allowedProviders?: string[];
  permissions: {
    chat: boolean;
    tools: boolean;
    streaming: boolean;
  };
  limits: {
    requestsPerMinute?: number;
    tokensPerDay?: number;
  };
  status: "active" | "revoked" | "expired";
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
}

interface StoredKeyRecord {
  id: string;
  prefix: string;
  secretHash: string;
  name: string;
  clientType: string;
  allowedModels: string[];
  allowedProviders?: string[];
  permissions: { chat: boolean; tools: boolean; streaming: boolean };
  limits: { requestsPerMinute?: number; tokensPerDay?: number };
  status: string;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
}

const DATA_DIR = join(process.cwd(), ".tgpt");
const KEYS_FILE = join(DATA_DIR, "api-keys.json");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadKeys(): StoredKeyRecord[] {
  ensureDataDir();
  if (!existsSync(KEYS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(KEYS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveKeys(keys: StoredKeyRecord[]): void {
  ensureDataDir();
  writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function generateApiKey(): { fullKey: string; prefix: string; secretHash: string } {
  const random = randomBytes(32).toString("hex");
  const fullKey = `tgpt_sk_${random}`;
  const prefix = fullKey.slice(0, 14);
  const secretHash = hashSecret(fullKey);
  return { fullKey, prefix, secretHash };
}

export function createApiKey(opts: {
  name: string;
  clientType?: "opencode" | "sigma_forge" | "external";
  allowedModels: string[];
  allowedProviders?: string[];
  permissions?: Partial<TeleGptApiKey["permissions"]>;
  limits?: Partial<TeleGptApiKey["limits"]>;
  expiresAt?: string;
}): { fullKey: string; key: TeleGptApiKey } {
  const { fullKey, prefix, secretHash } = generateApiKey();
  const id = `key_${Date.now()}_${randomBytes(4).toString("hex")}`;

  const record: StoredKeyRecord = {
    id,
    prefix,
    secretHash,
    name: opts.name,
    clientType: opts.clientType || "opencode",
    allowedModels: opts.allowedModels,
    allowedProviders: opts.allowedProviders,
    permissions: {
      chat: opts.permissions?.chat ?? true,
      tools: opts.permissions?.tools ?? true,
      streaming: opts.permissions?.streaming ?? true,
    },
    limits: opts.limits || {},
    status: "active",
    createdAt: new Date().toISOString(),
    expiresAt: opts.expiresAt,
  };

  const keys = loadKeys();
  keys.push(record);
  saveKeys(keys);

  return {
    fullKey,
    key: {
      ...record,
      status: record.status as "active",
      clientType: record.clientType as "opencode",
    },
  };
}

export function validateApiKey(rawKey: string): { valid: boolean; key?: TeleGptApiKey; error?: string } {
  if (!rawKey.startsWith("tgpt_sk_")) {
    return { valid: false, error: "Invalid key format" };
  }

  const incomingHash = hashSecret(rawKey);
  const keys = loadKeys();
  const match = keys.find((k) => k.secretHash === incomingHash);

  if (!match) {
    return { valid: false, error: "Unknown key" };
  }

  if (match.status !== "active") {
    return { valid: false, error: `Key is ${match.status}` };
  }

  if (match.expiresAt && new Date(match.expiresAt) < new Date()) {
    return { valid: false, error: "Key expired" };
  }

  match.lastUsedAt = new Date().toISOString();
  saveKeys(keys);

  return {
    valid: true,
    key: {
      ...match,
      status: match.status as "active",
      clientType: match.clientType as "opencode",
    },
  };
}

export function revokeApiKey(keyId: string): boolean {
  const keys = loadKeys();
  const idx = keys.findIndex((k) => k.id === keyId);
  if (idx < 0) return false;
  keys[idx].status = "revoked";
  saveKeys(keys);
  return true;
}

export function listApiKeys(): TeleGptApiKey[] {
  return loadKeys().map((k) => ({
    ...k,
    status: k.status as "active" | "revoked" | "expired",
    clientType: k.clientType as "opencode",
  }));
}

export function isModelAllowed(key: TeleGptApiKey, model: string): boolean {
  if (key.allowedModels.length === 0) return true;
  return key.allowedModels.some(
    (m) => m === model || m === "*" || model.startsWith(m.replace(/\*$/, ""))
  );
}
