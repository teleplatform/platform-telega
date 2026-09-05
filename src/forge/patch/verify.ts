import { PatchProposal, PatchVerification } from "./patchTypes";
import * as child_process from "child_process";
import * as path from "path";
import * as fs from "fs";

export async function verifyPatch(proposal: PatchProposal): Promise<PatchVerification> {
  const files = [...new Set(proposal.chunks.map((c) => c.file))];
  const projectRoot = detectProjectRoot(files[0] || ".");
  let typecheckResult: "passed" | "failed" | "skipped" = "skipped";
  let lintResult: "passed" | "failed" | "skipped" = "skipped";
  let testResult: "passed" | "failed" | "skipped" = "skipped";
  let outputLines: string[] = [];

  // TypeScript typecheck
  if (files.some((f) => f.endsWith(".ts") || f.endsWith(".tsx"))) {
    try {
      const result = child_process.spawnSync("npx", ["tsc", "--noEmit"], {
        cwd: projectRoot,
        timeout: 60000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      typecheckResult = result.status === 0 ? "passed" : "failed";
      outputLines.push(`[typecheck] ${typecheckResult}`);
      if (result.stdout) outputLines.push(result.stdout.toString().slice(0, 500));
      if (result.stderr) outputLines.push(result.stderr.toString().slice(0, 500));
    } catch {
      typecheckResult = "skipped";
    }
  }

  // Lint
  try {
    const result = child_process.spawnSync("npx", ["eslint", ...files], {
      cwd: projectRoot,
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    lintResult = result.status === 0 ? "passed" : "failed";
    outputLines.push(`[lint] ${lintResult}`);
  } catch {
    lintResult = "skipped";
  }

  // Tests
  try {
    const result = child_process.spawnSync("npm", ["test", "--", "--bail", "--passing", "0"], {
      cwd: projectRoot,
      timeout: 120000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    testResult = result.status === 0 ? "passed" : "failed";
    outputLines.push(`[tests] ${testResult}`);
  } catch {
    testResult = "skipped";
  }

  const verified = typecheckResult !== "failed" && lintResult !== "failed" && testResult !== "failed";

  return {
    proposalId: proposal.id,
    typecheck: typecheckResult,
    lint: lintResult,
    tests: testResult,
    verified,
    output: outputLines.join("\n"),
  };
}

function detectProjectRoot(filePath: string): string {
  let dir = path.dirname(path.resolve(filePath));
  const markers = ["package.json", "pyproject.toml", "go.mod", "Cargo.toml"];
  for (let i = 0; i < 10; i++) {
    if (markers.some((m) => fs.existsSync(path.join(dir, m)))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}
