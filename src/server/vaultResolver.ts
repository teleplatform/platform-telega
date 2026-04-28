/**
 * Vault Secret Resolver for Tele GPT
 *
 * This module allows Tele GPT to resolve secret aliases to actual values
 * stored in Vault. It provides a safe abstraction for accessing secrets
 * without exposing raw Vault paths.
 *
 * Usage:
 *   const resolver = createVaultResolver({ baseURL: "http://localhost:8200" });
 *   const apiKey = await resolver.resolve("openai:api_key");
 *
 * Architecture:
 *   Tele GPT → VaultResolver → Vault API → Secret Value
 */

export interface VaultResolverOptions {
  baseURL: string;
  token?: string;
  tokenEnvVar?: string;
  timeoutMs?: number;
  cacheTTL?: number; // milliseconds, 0 = no cache
}

export interface VaultSecretResult {
  found: boolean;
  value?: string;
  path?: string;
  error?: string;
  cached: boolean;
}

export interface VaultAuditEntry {
  alias: string;
  path: string;
  accessedAt: number;
  success: boolean;
  userId?: string;
}

export interface VaultResolver {
  resolve(alias: string, userId?: string): Promise<VaultSecretResult>;
  resolveMultiple(aliases: string[], userId?: string): Promise<Map<string, VaultSecretResult>>;
  getAuditLog(): VaultAuditEntry[];
  clearCache(): void;
}

const DEFAULT_OPTIONS: Required<Pick<VaultResolverOptions, "timeoutMs" | "cacheTTL" | "tokenEnvVar">> &
  Omit<VaultResolverOptions, "timeoutMs" | "cacheTTL" | "tokenEnvVar"> = {
  baseURL: "http://localhost:8200",
  token: undefined,
  tokenEnvVar: "VAULT_TOKEN",
  timeoutMs: 5_000,
  cacheTTL: 60_000,
};

/**
 * Resolve a secret alias to a Vault KV path.
 */
function aliasToVaultPath(alias: string): string {
  const env = process.env.VAULT_ENVIRONMENT ?? "production";

  const [category, ...rest] = alias.split(":");
  const name = rest.join(":") || category;

  const pathMap: Record<string, string> = {
    openai: `ai/openai/${env}/chat/primary`,
    anthropic: `ai/anthropic/${env}/chat/primary`,
    telegram: `messaging/telegram/${env}/bot/token`,
    db: `database/main/${env}/password`,
    redis: `cache/redis/${env}/password`,
    api: `api/external/${env}/key`,
    stripe: `payments/stripe/${env}/secret_key`,
    aws: `cloud/aws/${env}/credentials`,
    gcp: `cloud/gcp/${env}/credentials`,
    azure: `cloud/azure/${env}/credentials`,
  };

  const basePath = pathMap[category.toLowerCase()];
  if (basePath) {
    return `${basePath}/${name}`;
  }

  // Generic fallback
  return `secrets/${category}/${env}/${name}`;
}

/**
 * Create a Vault secret resolver for Tele GPT.
 */
export function createVaultResolver(
  options: VaultResolverOptions,
): VaultResolver {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const baseURL = config.baseURL.replace(/\/+$/, "");

  // Cache: alias → { value, expiresAt }
  const cache = new Map<string, { value: string; expiresAt: number }>();

  // Audit log
  const auditLog: VaultAuditEntry[] = [];
  const MAX_AUDIT_ENTRIES = 1000;

  function getToken(): string | undefined {
    return config.token ?? process.env[config.tokenEnvVar];
  }

  function addAudit(entry: Omit<VaultAuditEntry, "accessedAt">) {
    auditLog.unshift({ ...entry, accessedAt: Date.now() });
    if (auditLog.length > MAX_AUDIT_ENTRIES) {
      auditLog.pop();
    }
  }

  async function resolve(
    alias: string,
    userId?: string,
  ): Promise<VaultSecretResult> {
    // Check cache
    if (config.cacheTTL > 0) {
      const cached = cache.get(alias);
      if (cached && cached.expiresAt > Date.now()) {
        addAudit({ alias, path: aliasToVaultPath(alias), success: true, userId });
        return { found: true, value: cached.value, path: alias, cached: true };
      }
    }

    const token = getToken();
    if (!token) {
      addAudit({ alias, path: aliasToVaultPath(alias), success: false, userId });
      return {
        found: false,
        error: "Vault token not configured. Set VAULT_TOKEN or pass token option.",
        cached: false,
      };
    }

    const path = aliasToVaultPath(alias);

    try {
      const response = await fetch(`${baseURL}/v1/secret/data/${path}`, {
        method: "GET",
        headers: {
          "X-Vault-Token": token,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(config.timeoutMs),
      });

      if (!response.ok) {
        addAudit({ alias, path, success: false, userId });

        if (response.status === 404) {
          return { found: false, error: `Secret not found: ${path}`, cached: false };
        }

        return {
          found: false,
          error: `Vault API error: ${response.status}`,
          cached: false,
        };
      }

      const data = await response.json();

      // Vault KV v2 response format
      const secretData = data?.data?.data;
      if (!secretData) {
        addAudit({ alias, path, success: false, userId });
        return { found: false, error: "Invalid Vault response format", cached: false };
      }

      // Extract value: try common key names first, then first value
      const value =
        secretData.value ??
        secretData.secret ??
        secretData.password ??
        secretData.token ??
        secretData.api_key ??
        secretData.key ??
        Object.values(secretData)[0];

      if (value === undefined || value === null) {
        addAudit({ alias, path, success: false, userId });
        return { found: false, error: "Secret value is empty", cached: false };
      }

      const stringValue = String(value);

      // Cache the result
      if (config.cacheTTL > 0) {
        cache.set(alias, {
          value: stringValue,
          expiresAt: Date.now() + config.cacheTTL,
        });
      }

      addAudit({ alias, path, success: true, userId });

      return {
        found: true,
        value: stringValue,
        path,
        cached: false,
      };
    } catch (err: any) {
      addAudit({ alias, path, success: false, userId });
      return {
        found: false,
        error: err?.message ?? "Unknown error fetching secret",
        cached: false,
      };
    }
  }

  async function resolveMultiple(
    aliases: string[],
    userId?: string,
  ): Promise<Map<string, VaultSecretResult>> {
    const results = new Map<string, VaultSecretResult>();

    await Promise.all(
      aliases.map(async (alias) => {
        const result = await resolve(alias, userId);
        results.set(alias, result);
      }),
    );

    return results;
  }

  function getAuditLog(): VaultAuditEntry[] {
    return [...auditLog];
  }

  function clearCache(): void {
    cache.clear();
  }

  return {
    resolve,
    resolveMultiple,
    getAuditLog,
    clearCache,
  };
}

/**
 * Inject secrets into a message by replacing ${vault:alias} patterns.
 *
 * Example:
 *   "Use API key ${vault:openai:api_key} to call OpenAI"
 *   → "Use API key sk-... to call OpenAI"
 */
export async function injectVaultSecrets(
  message: string,
  resolver: VaultResolver,
  userId?: string,
): Promise<{
  message: string;
  injected: string[];
  errors: string[];
}> {
  const vaultPattern = /\$\{vault:([^}]+)\}/g;
  const matches = [...message.matchAll(vaultPattern)];

  if (matches.length === 0) {
    return { message, injected: [], errors: [] };
  }

  const injected: string[] = [];
  const errors: string[] = [];
  let result = message;

  for (const match of matches) {
    const fullMatch = match[0];
    const alias = match[1];

    const secretResult = await resolver.resolve(alias, userId);

    if (secretResult.found && secretResult.value) {
      result = result.replace(fullMatch, secretResult.value);
      injected.push(alias);
    } else {
      errors.push(`${alias}: ${secretResult.error ?? "not found"}`);
    }
  }

  return { message: result, injected, errors };
}
