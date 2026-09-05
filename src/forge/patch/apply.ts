import * as fs from "fs";
import { PatchProposal, PatchApplyResult, HashSnapshot } from "./patchTypes";
import { createHashSnapshot, verifyHashSnapshot, createHashSnapshots } from "./hashSnapshot";

export async function applyPatch(proposal: PatchProposal): Promise<PatchApplyResult> {
  const files = [...new Set(proposal.chunks.map((c) => c.file))];
  const hashBefore = createHashSnapshots(files);

  // Verify all files are unchanged since snapshot
  const conflicts: string[] = [];
  for (const snap of hashBefore) {
    if (!verifyHashSnapshot(snap)) {
      conflicts.push(snap.file);
    }
  }

  if (conflicts.length > 0) {
    return {
      proposalId: proposal.id,
      applied: false,
      filesChanged: 0,
      chunksApplied: 0,
      error: `PATCH_CONFLICT: files changed since snapshot: ${conflicts.join(", ")}`,
      hashBefore,
      hashAfter: [],
    };
  }

  // Group chunks by file and apply
  const fileChunks = new Map<string, typeof proposal.chunks>();
  for (const chunk of proposal.chunks) {
    if (!fileChunks.has(chunk.file)) fileChunks.set(chunk.file, []);
    fileChunks.get(chunk.file)!.push(chunk);
  }

  let totalChunksApplied = 0;

  for (const [file, chunks] of fileChunks) {
    try {
      let content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      // Sort chunks by line descending to apply bottom-up
      const sortedChunks = [...chunks].sort((a, b) => b.line - a.line);

      for (const chunk of sortedChunks) {
        const lineIndex = chunk.line - 1; // 0-indexed

        if (chunk.original && lines[lineIndex]?.includes(chunk.original.trim())) {
          // Replace
          lines[lineIndex] = lines[lineIndex].replace(chunk.original.trim(), chunk.patched.trim());
          totalChunksApplied++;
        } else if (chunk.patched && !chunk.original) {
          // Insert before line
          const indent = " ".repeat(2);
          const insertLines = chunk.patched.split("\n").map((l) => l.trim() ? indent + l.trim() : "");
          lines.splice(lineIndex, 0, ...insertLines);
          totalChunksApplied++;
        }
      }

      fs.writeFileSync(file, lines.join("\n"), "utf-8");
    } catch (e: any) {
      return {
        proposalId: proposal.id,
        applied: false,
        filesChanged: 0,
        chunksApplied: totalChunksApplied,
        error: `Failed to patch ${file}: ${e.message}`,
        hashBefore,
        hashAfter: [],
      };
    }
  }

  const hashAfter = createHashSnapshots(files);

  return {
    proposalId: proposal.id,
    applied: true,
    filesChanged: files.length,
    chunksApplied: totalChunksApplied,
    error: null,
    hashBefore,
    hashAfter,
  };
}
