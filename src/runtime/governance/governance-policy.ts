import type { SandboxPolicy } from "./governance-types.js";

const DEFAULT_POLICY: SandboxPolicy = {
  allowedShellPrefixes: [
    "echo",
    "ls",
    "cat ",
    "head ",
    "tail ",
    "wc ",
    "pwd",
    "whoami",
    "date",
    "uname",
    "which ",
    "mkdir -p ",
    "touch ",
    "cp ",
    "mv ",
    "rm ",
  ],
  blockedShellPatterns: [
    /rm\s+-rf\s+\//,
    /rm\s+-rf\s+~\//,
    /mkfs/,
    /dd\s+if=/,
    /:\(\)\s*\{/,
    />\s*\/dev\//,
    /chmod\s+777/,
    /sudo/,
    /su\s+/,
    /passwd/,
    /shutdown/,
    /reboot/,
    /init\s+/,
    /systemctl/,
    /kill/,
    /pkill/,
    /wget\s/,
    /curl\s+.*-o\s+/,
    /curl\s+.*--output/,
    /bash\s+-c\s+/,
    /eval/,
    /exec\s+/,
    /source\s+/,
  ],
  allowedFileWritePrefixes: [
    "/tmp/",
    "./",
    "src/",
    "tests/",
    ".data/",
  ],
  blockedFileWritePatterns: [
    /\/etc\//,
    /\/usr\//,
    /\/bin\//,
    /\/sbin\//,
    /\/var\//,
    /\/boot\//,
    /\/dev\//,
    /\/proc\//,
    /\/sys\//,
    /\/root\//,
    /~\/\.ssh\//,
    /~\/\.config\//,
    /~\/\.aws\//,
    /~\/\.kube\//,
  ],
  allowedHttpDomains: [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "api.github.com",
    "raw.githubusercontent.com",
    "registry.npmjs.org",
    "pypi.org",
    "files.pythonhosted.org",
  ],
  blockedHttpDomains: [
    /\.ru$/,
    /\.cn$/,
    /10\.\d+\.\d+\.\d+/,
    /192\.168\./,
    /172\.(1[6-9]|2\d|3[01])\./,
  ],
  allowedBrowserDomains: [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "github.com",
    "docs.github.com",
    "developer.mozilla.org",
    "wikipedia.org",
    "stackoverflow.com",
    "stackexchange.com",
    "npmjs.com",
    "pypi.org",
    "docker.com",
    "docs.docker.com",
    "kubernetes.io",
    "nodejs.org",
    "typescriptlang.org",
  ],
  blockedBrowserDomains: [
    /\.ru$/,
    /\.cn$/,
    /10\.\d+\.\d+\.\d+/,
    /192\.168\./,
  ],
  maxFileWriteKb: 100,
  maxShellTimeoutMs: 30000,
  maxActionsPerTask: 20,
  maxConcurrentTasks: 5,
};

let policy: SandboxPolicy = { ...DEFAULT_POLICY };

export function getPolicy(): SandboxPolicy {
  return { ...policy };
}

export function setPolicy(overrides: Partial<SandboxPolicy>): SandboxPolicy {
  policy = { ...policy, ...overrides };
  return getPolicy();
}

export function resetPolicy(): SandboxPolicy {
  policy = { ...DEFAULT_POLICY };
  return getPolicy();
}
