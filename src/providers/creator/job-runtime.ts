import fs from "fs/promises";
import path from "path";

const JOBS_DIR = path.join(process.cwd(), "data", "creator-bridge");
const JOBS_FILE = path.join(JOBS_DIR, "jobs.jsonl");
const MAX_CONCURRENT_JOBS = 2;
const JOB_TIMEOUT_MS = 600000;

export type JobStatus = "queued" | "running" | "waiting_provider" | "completed" | "failed" | "cancelled" | "timeout";

export interface Job {
  job_id: string;
  user_id: string;
  chat_id?: number;
  mode: "single" | "multi_agent" | "debate" | "research";
  message: string;
  strategy?: {
    mode: string;
    providers: string[];
    steps: string[];
  };
  provider_chain: string[];
  status: JobStatus;
  created_at: number;
  updated_at: number;
  started_at?: number;
  completed_at?: number;
  result_text?: string;
  error_code?: string;
  evidence_refs?: string[];
  progress?: {
    current_step: number;
    total_steps: number;
    current_provider?: string;
  };
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(JOBS_DIR, { recursive: true });
  } catch {}
}

async function appendJobToFile(job: Job): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(job) + "\n";
    await fs.appendFile(JOBS_FILE, line, "utf-8");
  } catch (e) {
    console.error("[job-runtime] write failed", e);
  }
}

async function loadJobsFromFile(): Promise<Job[]> {
  const jobs: Job[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(JOBS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.job_id && parsed.created_at) {
          jobs.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return jobs;
}

class JobRegistry {
  private jobs: Map<string, Job> = new Map();
  private queue: string[] = [];
  private running: Set<string> = new Set();
  private maxConcurrent = MAX_CONCURRENT_JOBS;

  async init(): Promise<void> {
    const loaded = await loadJobsFromFile();
    for (const job of loaded) {
      if (job.status === "queued" || job.status === "running") {
        job.status = "failed";
        job.error_code = "job_pending_on_restart";
      }
      this.jobs.set(job.job_id, job);
    }
    console.log("[job-runtime] loaded", this.jobs.size, "jobs");
    this.processQueue();
  }

  create(userId: string, chatId: number | undefined, message: string, mode: Job["mode"], providerChain: string[], strategy?: Job["strategy"]): Job {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const job: Job = {
      job_id: jobId,
      user_id: userId,
      chat_id: chatId,
      mode,
      message,
      strategy,
      provider_chain: providerChain,
      status: "queued",
      created_at: Date.now(),
      updated_at: Date.now(),
      progress: { current_step: 0, total_steps: strategy?.steps?.length || 1 },
    };
    
    this.jobs.set(jobId, job);
    this.queue.push(jobId);
    appendJobToFile(job);
    this.processQueue();
    
    return job;
  }

  get(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  listByUser(userId: string, limit = 10): Job[] {
    const userJobs = Array.from(this.jobs.values())
      .filter(j => j.user_id === userId)
      .sort((a, b) => b.created_at - a.created_at);
    return userJobs.slice(0, limit);
  }

  updateStatus(jobId: string, status: JobStatus, extra?: Partial<Job>): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    job.status = status;
    job.updated_at = Date.now();
    if (extra) {
      Object.assign(job, extra);
    }
    
    if (status === "completed" || status === "failed" || status === "cancelled" || status === "timeout") {
      job.completed_at = Date.now();
      this.running.delete(jobId);
      this.processQueue();
    }
    
    appendJobToFile(job);
    console.log("[job-runtime] job", jobId, status);
  }

  async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.running.size < this.maxConcurrent) {
      const jobId = this.queue.shift();
      if (!jobId) break;
      
      const job = this.jobs.get(jobId);
      if (!job || job.status !== "queued") continue;
      
      this.running.add(jobId);
      job.status = "running";
      job.started_at = Date.now();
      job.updated_at = Date.now();
      
      appendJobToFile(job);
      
      this.executeJob(job).catch(e => {
        console.error("[job-runtime] job execution error:", jobId, e?.message);
        this.updateStatus(jobId, "failed", { error_code: e?.message || "execution_error" });
      });
    }
  }

  private async executeJob(job: Job): Promise<void> {
    console.log("[job-runtime] executing job:", job.job_id, job.mode);
    
    try {
      const { executeStrategy } = await import("./strategy-engine.js");
      
      if (!job.strategy) {
        this.updateStatus(job.job_id, "failed", { error_code: "no_strategy" });
        return;
      }
      
      const strategy = {
        mode: job.strategy.mode as any,
        providers: job.strategy.providers as any,
        steps: job.strategy.steps.map((s, i) => ({
          step: i + 1,
          action: "execute" as const,
          provider: s as any,
          input: job.message,
        })),
        expectedOutput: "result",
        reasoning: job.strategy.mode,
      };
      
      const result = await executeStrategy(strategy, job.message);
      
      this.updateStatus(job.job_id, "completed", {
        result_text: result.text,
        evidence_refs: [job.job_id],
      });
      
    } catch (e: any) {
      if (e.message?.includes("timeout")) {
        this.updateStatus(job.job_id, "timeout", { error_code: "timeout" });
      } else {
        this.updateStatus(job.job_id, "failed", { error_code: e?.message || "execution_error" });
      }
    }
  }

  cancel(jobId: string, userId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    if (job.user_id !== userId) return false;
    if (job.status !== "queued" && job.status !== "running") return false;
    
    job.status = "cancelled";
    job.updated_at = Date.now();
    
    this.queue = this.queue.filter(id => id !== jobId);
    this.running.delete(jobId);
    
    appendJobToFile(job);
    this.processQueue();
    
    return true;
  }

  formatJobStatus(job: Job): string {
    const created = new Date(job.created_at).toLocaleString();
    let status = job.status === "running" ? "🔄" : job.status === "completed" ? "✅" : job.status === "failed" ? "❌" : "⏳";
    
    let text = `${status} Job: ${job.job_id}\n`;
    text += `Mode: ${job.mode}\n`;
    text += `Status: ${job.status}\n`;
    text += `Created: ${created}\n`;
    
    if (job.started_at) {
      const started = new Date(job.started_at).toLocaleTimeString();
      text += `Started: ${started}\n`;
    }
    
    if (job.result_text) {
      const preview = job.result_text.slice(0, 200);
      text += `\nResult:\n${preview}${job.result_text.length > 200 ? "..." : ""}`;
    }
    
    if (job.error_code) {
      text += `\nError: ${job.error_code}`;
    }
    
    return text;
  }
}

export const jobRegistry = new JobRegistry();

export async function initJobRegistry(): Promise<void> {
  await jobRegistry.init();
}

export function createJob(
  userId: string,
  chatId: number | undefined,
  message: string,
  mode: Job["mode"],
  providerChain: string[],
  strategy?: Job["strategy"]
): Job {
  return jobRegistry.create(userId, chatId, message, mode, providerChain, strategy);
}

export function getJob(jobId: string): Job | undefined {
  return jobRegistry.get(jobId);
}

export function listJobs(userId: string, limit?: number): Job[] {
  return jobRegistry.listByUser(userId, limit);
}

export function cancelJob(jobId: string, userId: string): boolean {
  return jobRegistry.cancel(jobId, userId);
}

export function formatJobStatus(job: Job): string {
  return jobRegistry.formatJobStatus(job);
}