
// Evidence Bundle Verification - Pack v1.8 Evidence Bundle v1

import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import type {
  EvidenceBundle,
  EvidenceFile,
  EvidenceManifest,
  EvidenceSeal,
  AgentSessionId,
} from "../../../../types/agentRuntime.js";

export interface EvidenceVerifier {
  verifyBundle(sid: AgentSessionId, evidenceDir: string): Promise<VerifyResult>;
}

export type VerifyResult = {
  ok: boolean;
  bundle_hash: string;
  verified: boolean;
  checks: {
    manifest: boolean;
    hash: boolean;
    trace: boolean;
    files: boolean;
  };
  errors?: string[];
};

export class EvidenceBundleVerifier implements EvidenceVerifier {
  async verifyBundle(
    sid: AgentSessionId,
    evidenceDir: string
  ): Promise<VerifyResult> {
    const bundleDir = join(evidenceDir, sid);
    const errors: string[] = [];
    const checks = {
      manifest: false,
      hash: false,
      trace: false,
      files: false,
    };

    try {
      // Read manifest
      const manifestPath = join(bundleDir, "manifest.json");
      const manifestContent = await readFile(manifestPath, "utf-8");
      const manifest: EvidenceManifest = JSON.parse(manifestContent);
      checks.manifest = true;

      // Verify manifest hash
      const computedManifestHash = createHash("sha256")
        .update(manifestContent)
        .digest("hex");
      if (computedManifestHash !== manifest.bundle_id) {
        errors.push("Manifest hash does not match bundle_id");
      } else {
        checks.hash = true;
      }

      // Verify all files
      let filesOk = true;
      for (const file of manifest.files) {
        const filePath = join(bundleDir, file.path);
        const fileContent = await readFile(filePath);
        const computedHash = createHash("sha256")
          .update(fileContent)
          .digest("hex");

        if (computedHash !== file.sha256) {
          errors.push(`File ${file.path} hash does not match`);
          filesOk = false;
        }

        // Check file size
        const stats = await import("fs/promises").then((fs) =>
          fs.stat(filePath)
        );
        if (stats.size !== file.bytes) {
          errors.push(`File ${file.path} size does not match`);
          filesOk = false;
        }
      }
      checks.files = filesOk;

      // Verify trace file exists
      const traceFile = manifest.files.find((f) => f.kind === "trace");
      if (!traceFile) {
        errors.push("No trace file found in manifest");
      } else {
        checks.trace = true;
      }

      // Read and verify seal
      const sealPath = join(bundleDir, "seal.json");
      const sealContent = await readFile(sealPath, "utf-8");
      const seal: EvidenceSeal = JSON.parse(sealContent);

      // Verify seal hashes
      if (seal.manifest_sha256 !== computedManifestHash) {
        errors.push("Seal manifest_sha256 does not match computed manifest hash");
      }

      if (seal.trace_sha256 !== traceFile?.sha256) {
        errors.push("Seal trace_sha256 does not match trace file hash");
      }

      // Verify bundle hash
      const computedBundleHash = this.computeBundleHash(
        manifest.files,
        computedManifestHash
      );
      if (computedBundleHash !== seal.bundle_hash) {
        errors.push("Seal bundle_hash does not match computed bundle hash");
      }

      // All checks passed
      const verified =
        checks.manifest &&
        checks.hash &&
        checks.trace &&
        checks.files &&
        errors.length === 0;

      return {
        ok: true,
        bundle_hash: seal.bundle_hash,
        verified,
        checks,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        bundle_hash: "",
        verified: false,
        checks,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
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
