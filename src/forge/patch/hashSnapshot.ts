import * as crypto from "crypto";
import * as fs from "fs";
import { HashSnapshot } from "./patchTypes";

export function createHashSnapshot(file: string): HashSnapshot {
  const content = fs.readFileSync(file, "utf-8");
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  return { file, hash, content, timestamp: Date.now() };
}

export function verifyHashSnapshot(snapshot: HashSnapshot): boolean {
  try {
    const currentContent = fs.readFileSync(snapshot.file, "utf-8");
    const currentHash = crypto.createHash("sha256").update(currentContent).digest("hex");
    return currentHash === snapshot.hash;
  } catch {
    return false;
  }
}

export function createHashSnapshots(files: string[]): HashSnapshot[] {
  return files.map((f) => createHashSnapshot(f));
}
