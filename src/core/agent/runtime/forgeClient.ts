
// ForgeClientZero - Client Zero: Forge uses Tele•GPT v1

import type {
  AgentSessionId,
  TraceEvent,
} from "../../../types/agentRuntime.js";

export interface ForgeClientConfig {
  baseUrl: string;
  auth?: {
    type: "bearer" | "none";
    token?: string;
  };
}

export interface RunRequest {
  input: {
    task?: string;
    messages?: Array<{ role: string; content: string }>;
    context_refs?: Array<{
      kind: "repo" | "artifact";
      remote?: string;
      ref?: string;
      commit?: string;
      path?: string;
    }>;
  };
  options: {
    model?: string;
    reply_mode?: "forge" | "default";
    tools?: {
      fs_read?: boolean;
      net_fetch?: boolean;
    };
  };
  forge?: {
    workspace?: {
      kind: "worktree";
      root: string;
      allow_paths?: string[];
      deny_paths?: string[];
    };
    tool_proxy?: {
      base_url: string;
      auth: {
        type: "bearer";
        token: string;
      };
    };
  };
}

export interface RunResponse {
  ok: boolean;
  sid?: AgentSessionId;
  status?: string;
  links?: {
    stream?: string;
    status?: string;
    evidence_verify?: string;
  };
  result?: {
    assistant_message?: string;
  };
  evidence?: {
    bundle_ref?: string;
    bundle_hash?: string;
    verify?: {
      procedure?: string;
      expected_ok?: boolean;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface VerifyRequest {
  bundle_ref: string;
}

export interface VerifyResponse {
  ok: boolean;
  bundle_hash: string;
  verified: boolean;
  checks: {
    manifest: boolean;
    hash: boolean;
    trace: boolean;
    files: boolean;
  };
  violations?: string[];
  error?: {
    code: string;
    message: string;
  };
}

export class ForgeClientZero {
  private config: ForgeClientConfig;

  constructor(config: ForgeClientConfig) {
    this.config = config;
  }

  async run(request: RunRequest): Promise<RunResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.config.auth?.type === "bearer" && this.config.auth.token) {
      headers["Authorization"] = `Bearer ${this.config.auth.token}`;
    }

    const response = await fetch(`${this.config.baseUrl}/v1/agent/run`, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: {
          code: error.code || "HTTP_ERROR",
          message: error.message || response.statusText,
        },
      };
    }

    return response.json();
  }

  async stream(sid: AgentSessionId, onEvent: (event: TraceEvent) => void): Promise<void> {
    const headers: Record<string, string> = {};

    if (this.config.auth?.type === "bearer" && this.config.auth.token) {
      headers["Authorization"] = `Bearer ${this.config.auth.token}`;
    }

    const response = await fetch(
      `${this.config.baseUrl}/v1/agent/stream?sid=${sid}`,
      {
        headers,
      }
    );

    if (!response.ok) {
      throw new Error(`Stream failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: trace")) {
          continue;
        }
        if (line.startsWith("id:")) {
          continue;
        }
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data) as TraceEvent;
            onEvent(event);
          } catch (e) {
            console.error("Failed to parse SSE event:", e);
          }
        }
      }
    }
  }

  async verify(request: VerifyRequest): Promise<VerifyResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.config.auth?.type === "bearer" && this.config.auth.token) {
      headers["Authorization"] = `Bearer ${this.config.auth.token}`;
    }

    const response = await fetch(
      `${this.config.baseUrl}/v1/evidence/verify`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        ok: false,
        bundle_hash: "",
        verified: false,
        checks: {
          manifest: false,
          hash: false,
          trace: false,
          files: false,
        },
        error: {
          code: error.code || "HTTP_ERROR",
          message: error.message || response.statusText,
        },
      };
    }

    return response.json();
  }
}
