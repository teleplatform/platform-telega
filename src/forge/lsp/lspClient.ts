import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import { LspLanguage, LspServerConfig, LspServerSession, LspStatus } from "./lspTypes";

const SERVER_CONFIGS: Record<LspLanguage, LspServerConfig> = {
  typescript: {
    language: "typescript",
    command: "npx",
    args: ["-y", "typescript-language-server", "--stdio"],
    projectRoot: ".",
  },
  python: {
    language: "python",
    command: "pyright-langserver",
    args: ["--stdio"],
    projectRoot: ".",
  },
  go: {
    language: "go",
    command: "gopls",
    args: [],
    projectRoot: ".",
  },
  rust: {
    language: "rust",
    command: "rust-analyzer",
    args: [],
    projectRoot: ".",
  },
};

const sessions = new Map<LspLanguage, LspServerSession>();

function getProjectRoot(language: LspLanguage): string {
  const config = SERVER_CONFIGS[language];
  if (!config) return process.cwd();

  // Walk up to find project root (contains package.json, pyproject.toml, go.mod, Cargo.toml)
  const markers: Record<LspLanguage, string> = {
    typescript: "package.json",
    python: "pyproject.toml",
    go: "go.mod",
    rust: "Cargo.toml",
  };

  const marker = markers[language];
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, marker))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

async function startLanguageServer(language: LspLanguage): Promise<LspServerSession> {
  const existing = sessions.get(language);
  if (existing && existing.status === "running") return existing;
  if (existing && existing.status === "starting") return existing;

  const config = SERVER_CONFIGS[language];
  const root = getProjectRoot(language);

  const session: LspServerSession = {
    language,
    status: "starting",
    process: null,
    startedAt: Date.now(),
  };
  sessions.set(language, session);

  try {
    const proc = child_process.spawn(config.command, config.args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: root,
    });

    session.process = proc;
    session.status = "running";

    proc.on("error", () => {
      session.status = "errored";
    });
    proc.on("exit", () => {
      session.status = "stopped";
      sessions.delete(language);
    });

    // Send initialize request
    const initMsg = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        processId: process.pid,
        rootUri: `file://${root}`,
        capabilities: {
          textDocument: {
            definition: { dynamicRegistration: false },
            references: { dynamicRegistration: false },
            hover: { dynamicRegistration: false },
            documentSymbol: { dynamicRegistration: false },
            completion: { dynamicRegistration: false },
          },
          workspace: {
            symbol: { dynamicRegistration: false },
          },
        },
      },
    });

    const contentLength = Buffer.byteLength(initMsg, "utf-8");
    const header = `Content-Length: ${contentLength}\r\n\r\n`;
    proc.stdin!.write(header + initMsg);

    // Wait for initialize result and send initialized notification
    const result = await waitForMessage(proc, 1, 5000);
    if (result) {
      const notif = JSON.stringify({ jsonrpc: "2.0", method: "initialized", params: {} });
      const nLen = Buffer.byteLength(notif, "utf-8");
      proc.stdin!.write(`Content-Length: ${nLen}\r\n\r\n` + notif);
    }

    return session;
  } catch (e) {
    session.status = "errored";
    return session;
  }
}

function waitForMessage(
  proc: child_process.ChildProcess,
  expectedId: number,
  timeoutMs: number
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    let buffer = "";

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf-8");
      while (buffer.includes("\r\n\r\n")) {
        const headerEnd = buffer.indexOf("\r\n\r\n") + 4;
        const headerPart = buffer.slice(0, headerEnd);
        const contentLengthMatch = headerPart.match(/Content-Length: (\d+)/);
        if (!contentLengthMatch) {
          buffer = buffer.slice(headerEnd);
          continue;
        }
        const contentLength = parseInt(contentLengthMatch[1], 10);
        const totalLength = headerEnd + contentLength;
        if (buffer.length < totalLength) break;

        const content = buffer.slice(headerEnd, totalLength);
        buffer = buffer.slice(totalLength);

        try {
          const msg = JSON.parse(content);
          if (msg.id === expectedId || msg.id === 1) {
            clearTimeout(timer);
            proc.stdout?.removeListener("data", onData);
            resolve(msg);
            return;
          }
        } catch {
          // skip malformed
        }
      }
    };

    proc.stdout?.on("data", onData);
    proc.on("exit", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

async function sendRequest(
  language: LspLanguage,
  method: string,
  params: any
): Promise<any> {
  const session = await startLanguageServer(language);
  if (session.status !== "running") {
    throw new Error(`LSP server for ${language} is not running (${session.status})`);
  }

  const id = Date.now() + Math.floor(Math.random() * 1000);
  const request = JSON.stringify({
    jsonrpc: "2.0",
    id,
    method,
    params,
  });

  const contentLength = Buffer.byteLength(request, "utf-8");
  const header = `Content-Length: ${contentLength}\r\n\r\n`;
  session.process.stdin.write(header + request);

  return await waitForMessage(session.process, id, 10000);
}

export async function getDefinition(
  language: LspLanguage,
  file: string,
  line: number,
  character: number
): Promise<any> {
  const result = await sendRequest(language, "textDocument/definition", {
    textDocument: { uri: `file://${path.resolve(file)}` },
    position: { line, character },
  });
  return result;
}

export async function getReferences(
  language: LspLanguage,
  file: string,
  line: number,
  character: number
): Promise<any> {
  const result = await sendRequest(language, "textDocument/references", {
    textDocument: { uri: `file://${path.resolve(file)}` },
    position: { line, character },
    context: { includeDeclaration: true },
  });
  return result;
}

export async function getHover(
  language: LspLanguage,
  file: string,
  line: number,
  character: number
): Promise<any> {
  const result = await sendRequest(language, "textDocument/hover", {
    textDocument: { uri: `file://${path.resolve(file)}` },
    position: { line, character },
  });
  return result;
}

export async function getWorkspaceSymbols(
  language: LspLanguage,
  query: string
): Promise<any> {
  const result = await sendRequest(language, "workspace/symbol", { query });
  return result;
}

export async function getDocumentSymbols(
  language: LspLanguage,
  file: string
): Promise<any> {
  const result = await sendRequest(language, "textDocument/documentSymbol", {
    textDocument: { uri: `file://${path.resolve(file)}` },
  });
  return result;
}

export function stopLanguageServer(language: LspLanguage): void {
  const session = sessions.get(language);
  if (session && session.process) {
    session.process.kill();
    sessions.delete(language);
  }
}

export function stopAllServers(): void {
  for (const [lang] of sessions) {
    stopLanguageServer(lang);
  }
}
