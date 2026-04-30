#!/usr/bin/env node
import http from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

type WebProvider = "chatgpt_web" | "qwen_web" | "deepseek_web";
type JobStatus = "queued" | "running" | "done" | "failed";

type Job = {
  id: string;
  created_at: number;
  status: JobStatus;
  cmd: string[];
  provider: WebProvider;
  exit_code?: number;
  logs: string[];
};

const PORT = Number(process.env.TELEGPT_LOCAL_RUNNER_PORT || 8787);
const TOKEN = String(process.env.TELEGPT_LOCAL_RUNNER_TOKEN || "").trim();

if (!TOKEN || TOKEN.length < 16) {
  console.error("[runnerd] TELEGPT_LOCAL_RUNNER_TOKEN is missing/too short");
  process.exit(1);
}

const jobs = new Map<string, Job>();

function json(res: http.ServerResponse, status: number, payload: any) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(body.length),
  });
  res.end(body);
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += String(c)));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function assertAuth(req: http.IncomingMessage): boolean {
  const h = String(req.headers.authorization || "");
  return h === `Bearer ${TOKEN}`;
}

function parseProvider(x: any): WebProvider | null {
  const p = String(x || "").trim();
  if (p === "chatgpt_web" || p === "qwen_web" || p === "deepseek_web") return p;
  return null;
}

function appendLog(job: Job, chunk: string) {
  const lines = chunk.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    job.logs.push(line);
  }
  if (job.logs.length > 500) {
    job.logs = job.logs.slice(job.logs.length - 500);
  }
}

function startJob(action: string, provider: WebProvider): Job {
  const id = randomUUID();
  const cmd = ["pnpm", "tele-gpt:web", action, provider];
  const job: Job = {
    id,
    created_at: Date.now(),
    status: "running",
    cmd,
    provider,
    logs: [],
  };
  jobs.set(id, job);

  const child = spawn(cmd[0], cmd.slice(1), {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  child.stdout?.on("data", (buf) => appendLog(job, String(buf)));
  child.stderr?.on("data", (buf) => appendLog(job, String(buf)));

  child.on("error", (err) => {
    job.status = "failed";
    appendLog(job, String(err?.message || err));
  });

  child.on("close", (code) => {
    job.exit_code = code ?? 0;
    job.status = code === 0 ? "done" : "failed";
  });

  return job;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (!assertAuth(req)) return json(res, 401, { ok: false, error: "unauthorized" });

  if (req.method === "GET" && url.pathname === "/v1/ping") {
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/v1/jobs") {
    const body = await readBody(req);
    const action = String(body?.action || "");
    const provider = parseProvider(body?.provider);
    if (!provider) return json(res, 400, { ok: false, error: "bad_provider" });
    if (action !== "web:login" && action !== "web:health") {
      return json(res, 400, { ok: false, error: "bad_action" });
    }
    const job = startJob(action, provider);
    return json(res, 200, { ok: true, job_id: job.id, status: job.status });
  }

  if (req.method === "GET" && url.pathname.startsWith("/v1/jobs/")) {
    const id = decodeURIComponent(url.pathname.replace("/v1/jobs/", "").trim());
    const job = jobs.get(id);
    if (!job) return json(res, 404, { ok: false, error: "job_not_found" });
    return json(res, 200, { ok: true, job });
  }

  return json(res, 404, { ok: false, error: "not_found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[runnerd] listening on http://127.0.0.1:${PORT}`);
});
