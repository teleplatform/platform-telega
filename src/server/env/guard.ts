function normUrl(u: string) {
  return u.trim().replace(/\/+$/, "");
}

export type TelegaMode = "public" | "creator" | "core";

export function getMode(): TelegaMode {
  const v = (process.env.TELEGA_MODE || "").trim().toLowerCase();
  if (v === "public" || v === "creator" || v === "core") return v;
  return "public";
}

export function guardCreatorOnlyBaseUrl(input: {
  baseUrlEnvName: string;
  baseUrlValue?: string;
  logger?: { warn: (o: any, msg?: string) => void };
}) {
  const mode = getMode();
  const raw = input.baseUrlValue?.trim();

  if (!raw) return { allowed: true, baseUrl: undefined };

  const baseUrl = normUrl(raw);

  if (mode !== "creator") {
    input.logger?.warn(
      { mode, env: input.baseUrlEnvName, baseUrl },
      "blocked: creator-only provider base_url"
    );
    throw new Error(`CREATOR_ONLY_BASE_URL_BLOCKED: ${input.baseUrlEnvName}`);
  }

  const allowedHosts = ["localhost", "127.0.0.1", "host.docker.internal"];
  try {
    const u = new URL(baseUrl);
    if (!allowedHosts.includes(u.hostname)) {
      throw new Error(`CREATOR_ONLY_HOST_NOT_ALLOWED: ${u.hostname}`);
    }
  } catch (_err) {
    throw new Error(`INVALID_BASE_URL: ${baseUrl}`);
  }

  return { allowed: true, baseUrl };
}
