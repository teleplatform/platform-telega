
// Evidence Bundle Sealing - Pack v1.8 Evidence Bundle v1

import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type {
  EvidenceBundle,
  EvidenceFile,
  EvidenceManifest,
  EvidenceSeal,
  AgentSessionId,
} from "../../../../types/agentRuntime.js";

export interface EvidenceSealer {
  sealBundle(sid: AgentSessionId, evidenceDir: string): Promise<EvidenceBundle>;
}

export class EvidenceBundleSealer implements EvidenceSealer {
  private producerVersion: string;

  constructor(producerVersion: string = "1.0.0") {
    this.producerVersion = producerVersion;
  }

  async sealBundle(
    sid: AgentSessionId,
    evidenceDir: string
  ): Promise<EvidenceBundle> {
    const bundleDir = join(evidenceDir, sid);
    await mkdir(bundleDir, { recursive: true });

    // Collect all files in bundle directory
    const files = await this.collectFiles(bundleDir);

    // Compute SHA-256 for each file
    const filesWithHashes = await Promise.all(
      files.map(async (file) => ({
        ...file,
        sha256: await this.computeFileHash(join(bundleDir, file.path)),
      }))
    );

    // Create manifest
    const manifest: EvidenceManifest = {
      v: 1,
      bundle_id: `bundle_${randomUUID()}`,
      sid,
      created_at: new Date().toISOString(),
      producer: {
        kind: "telegpt-runtime",
        version: this.producerVersion,
      },
      files: filesWithHashes,
    };

    // Write manifest to file
    const manifestPath = join(bundleDir, "manifest.json");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    // Compute manifest hash
    const manifestHash = createHash("sha256")
      .update(JSON.stringify(manifest))
      .digest("hex");

    // Find trace file
    const traceFile = filesWithHashes.find((f) => f.kind === "trace");
    if (!traceFile) {
      throw new Error("No trace file found in bundle");
    }

    // Compute bundle hash
    const bundleHash = this.computeBundleHash(filesWithHashes, manifestHash);

    // Create seal
    const seal: EvidenceSeal = {
      v: 1,
      alg: "sha256",
      canonicalization: "jcs",
      bundle_hash: bundleHash,
      manifest_sha256: manifestHash,
      trace_sha256: traceFile.sha256,
      sealed_at: new Date().toISOString(),
      policy: {
        hash_includes: ["manifest", "trace", "artifacts"],
        order: true,
      },
    };

    // Write seal to file
    const sealPath = join(bundleDir, "seal.json");
    await writeFile(sealPath, JSON.stringify(seal, null, 2));

    // Add manifest and seal to files list
    const allFiles: EvidenceFile[] = [
      ...filesWithHashes,
      {
        path: "manifest.json",
        bytes: Buffer.byteLength(JSON.stringify(manifest)),
        sha256: manifestHash,
        kind: "manifest",
      },
      {
        path: "seal.json",
        bytes: Buffer.byteLength(JSON.stringify(seal)),
        sha256: createHash("sha256")
          .update(JSON.stringify(seal))
          .digest("hex"),
        kind: "seal",
      },
    ];

    return {
      bundle_id: manifest.bundle_id,
      sid,
      created_at: manifest.created_at,
      files: allFiles,
      manifest,
      seal,
    };
  }

  private async collectFiles(
    bundleDir: string
  ): Promise<Omit<EvidenceFile, "sha256">[]> {
    const files: Omit<EvidenceFile, "sha256">[] = [];
    const entries = await readdir(bundleDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Recursively collect files from subdirectories
        const subDir = join(bundleDir, entry.name);
        const subFiles = await this.collectFiles(subDir);
        files.push(
          ...subFiles.map((f) => ({
            ...f,
            path: join(entry.name, f.path),
          }))
        );
      } else if (entry.isFile()) {
        const filePath = join(bundleDir, entry.name);
        const stats = await import("fs/promises").then((fs) =>
          fs.stat(filePath)
        );

        // Determine file kind
        let kind: EvidenceFile["kind"] = "artifact";
        if (entry.name === "trace.jsonl") {
          kind = "trace";
        }

        files.push({
          path: entry.name,
          bytes: stats.size,
          kind,
        });
      }
    }

    return files;
  }

  private async computeFileHash(filePath: string): Promise<string> {
    const content = await readFile(filePath);
    return createHash("sha256").update(content).digest("hex");
  }

  private computeBundleHash(
    files: EvidenceFile[],
    manifestHash: string
  ): string {
    // Sort files by path for deterministic order
    const sortedFiles = [...files].sort((a, b) =>
      a.path.localeCompare(b.path)
    );

    // Create canonical representation
    const canonical = JSON.stringify({
      manifest_hash: manifestHash,
      files: sortedFiles.map((f) => ({
        path: f.path,
        sha256: f.sha256,
        bytes: f.bytes,
      })),
    });

    return createHash("sha256").update(canonical).digest("hex");
  }
}
