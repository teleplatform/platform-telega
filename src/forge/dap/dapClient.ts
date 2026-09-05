import * as child_process from "child_process";
import * as path from "path";
import * as net from "net";
import { DapSession, DapLaunchConfig, DapLanguage, DapSessionStatus, DapBreakpoint } from "./dapTypes";
import { randomUUID } from "crypto";

const sessions = new Map<string, DapSession>();

let breakpointCounter = 0;

function generateId(): string {
  return `dap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function waitForMessage(client: net.Socket, expectedCommand: string, timeoutMs = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    let buffer = "";

    client.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf-8");
      while (buffer.includes("\r\n\r\n")) {
        const headerEnd = buffer.indexOf("\r\n\r\n") + 4;
        const headerPart = buffer.slice(0, headerEnd);
        const contentLengthMatch = headerPart.match(/Content-Length: (\d+)/);
        if (!contentLengthMatch) { buffer = buffer.slice(headerEnd); continue; }
        const contentLength = parseInt(contentLengthMatch[1], 10);
        const totalLength = headerEnd + contentLength;
        if (buffer.length < totalLength) break;

        const content = buffer.slice(headerEnd, totalLength);
        buffer = buffer.slice(totalLength);
        try {
          const msg = JSON.parse(content);
          if (msg.type === "event" && msg.event === expectedCommand) {
            clearTimeout(timer);
            client.removeAllListeners("data");
            resolve(msg);
            return;
          }
          if (msg.type === "response" && msg.command === expectedCommand) {
            clearTimeout(timer);
            client.removeAllListeners("data");
            resolve(msg);
            return;
          }
        } catch { /* skip */ }
      }
    });

    client.on("close", () => { clearTimeout(timer); resolve(null); });
  });
}

function sendDapMessage(client: net.Socket, message: any): void {
  const body = JSON.stringify(message);
  const header = `Content-Length: ${Buffer.byteLength(body, "utf-8")}\r\n\r\n`;
  client.write(header + body);
}

export async function startDebugSession(config: DapLaunchConfig): Promise<DapSession> {
  const id = generateId();

  const session: DapSession = {
    id,
    language: config.language,
    status: "starting",
    launchConfig: config,
    process: null,
    startedAt: Date.now(),
    breakpoints: [],
    exceptionInfo: null,
  };
  sessions.set(id, session);

  try {
    if (config.language === "node") {
      // Start Node.js inspect mode
      const args = ["--inspect-brk=0", config.program, ...(config.args || [])];
      const proc = child_process.spawn("node", args, {
        cwd: config.cwd || process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...(config.env || {}) },
      });

      session.process = proc;
      session.status = "running";

      proc.stdout?.on("data", (data) => {
        const match = data.toString().match(/ws:\/\/(.+)/);
        if (match) {
          // Inspector started — we could connect via CDP, but for DAP we use the debugger port
          const wsUrl = match[1].trim();
          // Connect to debugger via TCP inspector
          connectInspector(session, wsUrl).catch(() => {});
        }
      });

      proc.on("exit", () => {
        session.status = "stopped";
        sessions.delete(id);
      });
    }

    return session;
  } catch (e: any) {
    session.status = "errored";
    return session;
  }
}

async function connectInspector(session: DapSession, _wsUrl: string): Promise<void> {
  // For v1, we use the --inspect-brk port which outputs ws:// URL
  // We parse the port and connect via TCP to send CDP/DAP messages
  try {
    const portMatch = _wsUrl.match(/:(\d+)\//);
    if (!portMatch) return;
    const port = parseInt(portMatch[1], 10);
    const client = new net.Socket();

    await new Promise<void>((resolve, reject) => {
      client.connect(port, "127.0.0.1", () => resolve());
      client.on("error", reject);
    });

    // Store client reference for communication
    (session as any)._client = client;

    // Send Debug Adapter Protocol initialize request
    sendDapMessage(client, {
      type: "request",
      seq: 1,
      command: "initialize",
      arguments: {
        clientID: "telegram-forge",
        clientName: "TeleGPT Forge DAP Bridge",
        adapterID: "node",
        locale: "en",
        linesStartAt1: true,
        columnsStartAt1: true,
        supportsVariableType: true,
        supportsVariablePaging: true,
        supportsRunInTerminalRequest: false,
      },
    });

    const initResult = await waitForMessage(client, "initialize", 5000);
    if (initResult) {
      // Send initialized event
      sendDapMessage(client, { type: "event", event: "initialized" });
      session.status = "running";
    }
  } catch {
    session.status = "errored";
  }
}

export async function setBreakpoint(
  sessionId: string,
  file: string,
  line: number
): Promise<DapBreakpoint | null> {
  const session = sessions.get(sessionId);
  if (!session) return null;

  breakpointCounter++;
  const bp: DapBreakpoint = { id: breakpointCounter, file, line, verified: false };
  session.breakpoints.push(bp);

  const client = (session as any)._client as net.Socket | undefined;
  if (client) {
    sendDapMessage(client, {
      type: "request",
      seq: Date.now(),
      command: "setBreakpoints",
      arguments: {
        source: { path: path.resolve(file) },
        breakpoints: [{ line }],
        lines: [line],
      },
    });
  }

  return bp;
}

export async function continueExecution(sessionId: string): Promise<boolean> {
  const session = sessions.get(sessionId);
  if (!session) return false;

  const client = (session as any)._client as net.Socket | undefined;
  if (client) {
    sendDapMessage(client, {
      type: "request",
      seq: Date.now(),
      command: "continue",
      arguments: { threadId: 1 },
    });
  }

  session.status = "running";
  return true;
}

export async function getStackTrace(sessionId: string): Promise<any[]> {
  const session = sessions.get(sessionId);
  if (!session) return [];

  const client = (session as any)._client as net.Socket | undefined;
  if (!client) return [];

  sendDapMessage(client, {
    type: "request",
    seq: Date.now(),
    command: "stackTrace",
    arguments: { threadId: 1, startFrame: 0, levels: 20 },
  });

  const result = await waitForMessage(client, "stackTrace", 5000);
  return result?.body?.stackFrames || [];
}

export async function getScopes(sessionId: string, frameId: number): Promise<any[]> {
  const session = sessions.get(sessionId);
  if (!session) return [];

  const client = (session as any)._client as net.Socket | undefined;
  if (!client) return [];

  sendDapMessage(client, {
    type: "request",
    seq: Date.now(),
    command: "scopes",
    arguments: { frameId },
  });

  const result = await waitForMessage(client, "scopes", 5000);
  return result?.body?.scopes || [];
}

export async function getVariables(sessionId: string, variablesReference: number): Promise<any[]> {
  const session = sessions.get(sessionId);
  if (!session) return [];

  const client = (session as any)._client as net.Socket | undefined;
  if (!client) return [];

  sendDapMessage(client, {
    type: "request",
    seq: Date.now(),
    command: "variables",
    arguments: { variablesReference },
  });

  const result = await waitForMessage(client, "variables", 5000);
  return result?.body?.variables || [];
}

export async function evaluateExpression(
  sessionId: string,
  expression: string
): Promise<string | null> {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const client = (session as any)._client as net.Socket | undefined;
  if (!client) return null;

  sendDapMessage(client, {
    type: "request",
    seq: Date.now(),
    command: "evaluate",
    arguments: { expression, context: "repl" },
  });

  const result = await waitForMessage(client, "evaluate", 5000);
  return result?.body?.result || null;
}

export async function stopDebugSession(sessionId: string): Promise<boolean> {
  const session = sessions.get(sessionId);
  if (!session) return false;

  const client = (session as any)._client as net.Socket | undefined;
  if (client) {
    sendDapMessage(client, {
      type: "request",
      seq: Date.now(),
      command: "disconnect",
      arguments: { restart: false, terminateDebuggee: true },
    });
    client.destroy();
  }

  if (session.process) {
    session.process.kill();
  }

  session.status = "stopped";
  sessions.delete(sessionId);
  return true;
}

export function stopAllSessions(): void {
  for (const [id] of sessions) {
    stopDebugSession(id);
  }
}

export function getSession(id: string): DapSession | undefined {
  return sessions.get(id);
}

export function getAllSessions(): DapSession[] {
  return Array.from(sessions.values());
}
