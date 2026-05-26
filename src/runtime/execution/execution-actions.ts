import http from "node:http";
import https from "node:https";
import { execSync } from "node:child_process";
import fs from "node:fs";
import type { Action } from "./execution-types.js";
import { getBrowserSession } from "../browser/browser-session.js";
import {
  executeBrowserNavigate,
  executeBrowserClick,
  executeBrowserType,
  executeBrowserScreenshot,
  executeBrowserExtract,
  executeBrowserWait,
} from "../browser/browser-execution.js";
import { recordBrowserEvidence } from "../browser/browser-evidence.js";

export interface ActionResult {
  result: unknown;
  evidence?: string;
}

export async function executeAction(action: Action): Promise<ActionResult> {
  switch (action.type) {
    case "http":
      return executeHttp(action);
    case "shell":
      return executeShell(action);
    case "file_read":
      return executeFileRead(action);
    case "file_write":
      return executeFileWrite(action);
    case "verify":
      return executeVerify(action);
    case "browser_navigate":
      return execBrowserNavigate(action);
    case "browser_click":
      return execBrowserClick(action);
    case "browser_type":
      return execBrowserType(action);
    case "browser_screenshot":
      return execBrowserScreenshot(action);
    case "browser_extract":
      return execBrowserExtract(action);
    case "browser_wait":
      return execBrowserWait(action);
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

async function executeHttp(action: Action): Promise<ActionResult> {
  const { url, method = "GET", body, headers = {}, timeoutMs = 30000 } = action.params as Record<string, any>;
  if (!url) throw new Error("HTTP action requires url");

  return new Promise((resolve, reject) => {
    const urlObj = new URL(String(url));
    const client = urlObj.protocol === "https:" ? https : http;
    const req = client.request(
      urlObj,
      {
        method: String(method),
        headers: { ...headers, "content-type": "application/json" },
        timeout: Number(timeoutMs),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8");
          resolve({ result: { statusCode: res.statusCode, body: raw.slice(0, 500) } });
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("HTTP timeout")); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function executeShell(action: Action): Promise<ActionResult> {
  const { command, timeoutMs = 30000 } = action.params as Record<string, any>;
  if (!command) throw new Error("Shell action requires command");
  try {
    const output = execSync(String(command), { timeout: Number(timeoutMs), encoding: "utf-8" });
    return { result: { stdout: output.slice(0, 1000) } };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    throw new Error(err.stderr || err.message || String(e));
  }
}

async function executeFileRead(action: Action): Promise<ActionResult> {
  const { path: filePath, maxSize = 10000 } = action.params as Record<string, any>;
  if (!filePath) throw new Error("File read action requires path");
  if (!fs.existsSync(String(filePath))) throw new Error(`File not found: ${filePath}`);
  const content = fs.readFileSync(String(filePath), "utf-8").slice(0, Number(maxSize));
  return { result: { path: filePath, size: content.length, content: content.slice(0, 500) } };
}

async function executeFileWrite(action: Action): Promise<ActionResult> {
  const { path: filePath, content } = action.params as Record<string, any>;
  if (!filePath) throw new Error("File write action requires path");
  fs.writeFileSync(String(filePath), String(content ?? ""), "utf-8");
  return { result: { path: filePath, written: String(content ?? "").length } };
}

async function executeVerify(action: Action): Promise<ActionResult> {
  const { check, expected } = action.params as Record<string, any>;
  const actual = String(check ?? "");
  const passed = actual.includes(String(expected ?? ""));
  return {
    result: { passed, expected: String(expected), actual: actual.slice(0, 200) },
    evidence: passed ? "verification_passed" : "verification_failed",
  };
}

async function execBrowserNavigate(action: Action): Promise<ActionResult> {
  const result = await executeBrowserNavigate(action);
  recordBrowserEvidence("page_source", undefined, result.url);
  return { result, evidence: `navigated:${result.url}` };
}

async function execBrowserClick(action: Action): Promise<ActionResult> {
  const result = await executeBrowserClick(action);
  return { result, evidence: result.elementFound ? "clicked" : "click_failed" };
}

async function execBrowserType(action: Action): Promise<ActionResult> {
  const result = await executeBrowserType(action);
  return { result, evidence: result.elementFound ? "typed" : "type_failed" };
}

async function execBrowserScreenshot(action: Action): Promise<ActionResult> {
  const result = await executeBrowserScreenshot(action);
  recordBrowserEvidence("screenshot", result.screenshotPath);
  return { result, evidence: `screenshot:${result.screenshotPath}` };
}

async function execBrowserExtract(action: Action): Promise<ActionResult> {
  const result = await executeBrowserExtract(action);
  recordBrowserEvidence("text_content", undefined, result.text?.slice(0, 500));
  return { result, evidence: `extracted:${result.text?.length ?? 0}chars` };
}

async function execBrowserWait(action: Action): Promise<ActionResult> {
  const result = await executeBrowserWait(action);
  return { result, evidence: result.elementFound ? "found" : "not_found" };
}
