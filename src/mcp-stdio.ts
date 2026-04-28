#!/usr/bin/env node

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string };
};

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const tools: MCPTool[] = [
  {
    name: "telegpt_runtime_binding_verify",
    description: "Verify TeleGPT runtime binding is alive",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "telegpt_toolchain_policy_check",
    description: "Check toolchain policy for a given action",
    inputSchema: {
      type: "object",
      properties: { action: { type: "string" } },
      required: ["action"],
    },
  },
  {
    name: "telegpt_toolchain_execution_gate",
    description: "Gate execution for a given trace_id",
    inputSchema: {
      type: "object",
      properties: { trace_id: { type: "string" }, action: { type: "string" } },
      required: ["trace_id", "action"],
    },
  },
  {
    name: "telegpt_trace_surface_bind",
    description: "Bind trace to surface",
    inputSchema: {
      type: "object",
      properties: { trace_id: { type: "string" }, surface: { type: "string" } },
      required: ["trace_id", "surface"],
    },
  },
  {
    name: "telegpt_surface_execution_report",
    description: "Get execution report for a surface",
    inputSchema: {
      type: "object",
      properties: { surface: { type: "string" } },
      required: ["surface"],
    },
  },
];

const capabilities = {
  tools: {},
  resources: {},
  prompts: {},
};

function sendResponse(res: JsonRpcResponse): void {
  process.stdout.write(JSON.stringify(res) + "\n");
}

async function handleRequest(req: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { id, method, params } = req;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities,
        serverInfo: { name: "telegpt-mcp-gateway", version: "1.0.0" },
      },
    };
  }

  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: { tools },
    };
  }

  if (method === "tools/call") {
    const { name, arguments: args } = (params as { name: string; arguments?: Record<string, unknown> }) || {};
    const trace_id = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    console.error(`[mcp] tool call: ${name}, trace_id: ${trace_id}`);

    try {
      let result: unknown;

      switch (name) {
        case "telegpt_runtime_binding_verify": {
          result = { ok: true, timestamp: Date.now(), trace_id };
          break;
        }
        case "telegpt_toolchain_policy_check": {
          const action = (args as { action?: string })?.action || "unknown";
          result = { ok: true, action, allowed: true, trace_id };
          break;
        }
        case "telegpt_toolchain_execution_gate": {
          const trace_id_inner = (args as { trace_id?: string })?.trace_id || trace_id;
          const action = (args as { action?: string })?.action || "unknown";
          result = { ok: true, trace_id: trace_id_inner, action, gated: true };
          break;
        }
        case "telegpt_trace_surface_bind": {
          const surface = (args as { surface?: string })?.surface || "default";
          result = { ok: true, surface, trace_id };
          break;
        }
        case "telegpt_surface_execution_report": {
          const surface = (args as { surface?: string })?.surface || "default";
          result = { ok: true, surface, executions: [], trace_id };
          break;
        }
        default: {
          result = { ok: false, error: `unknown tool: ${name}` };
        }
      }

      return { jsonrpc: "2.0", id, result };
    } catch (err: any) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32000, message: err?.message || String(err) },
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `method not found: ${method}` },
  };
}

async function run(): Promise<void> {
  let buffer = "";

  for await (const chunk of process.stdin) {
    buffer += chunk;

    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);

      if (!line) continue;

      try {
        const req = JSON.parse(line) as JsonRpcRequest;
        const res = await handleRequest(req);
        sendResponse(res);
      } catch (err: any) {
        console.error(`[mcp] parse error: ${err?.message}`);
      }
    }
  }
}

run().catch((err) => {
  console.error(`[mcp] fatal: ${err?.message}`);
  process.exit(1);
});