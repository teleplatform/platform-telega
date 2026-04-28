import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { stat, readFile } from "fs/promises";
import path from "path";

const KOZY_OUT_DIR = process.env.KOZY_OUT_DIR
  ?? "/Users/vijaytaitoo/Projects/tele-gpt-providers/Cozy_voice_TGPG/out";

function safeResolve(filename: string): string | null {
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return null;
  }

  if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {
    return null;
  }

  const resolved = path.resolve(KOZY_OUT_DIR, filename);
  if (!resolved.startsWith(path.resolve(KOZY_OUT_DIR))) {
    return null;
  }

  return resolved;
}

export async function registerVoiceFileRoute(app: FastifyInstance) {
  app.get(
    "/v1/voice/files/:filename",
    async (req: FastifyRequest<{ Params: { filename: string } }>, reply: FastifyReply) => {
      const filename = req.params.filename;
      const resolved = safeResolve(filename);

      if (!resolved) {
        return reply.status(400).send({
          ok: false,
          error: "invalid filename",
        });
      }

      try {
        const fileStat = await stat(resolved);
        if (!fileStat.isFile()) {
          return reply.status(404).send({
            ok: false,
            error: "not a file",
          });
        }
      } catch {
        return reply.status(404).send({
          ok: false,
          error: "file not found",
          filename,
        });
      }

      const fileBuffer = await readFile(resolved);
      return reply
        .header("Content-Type", "audio/wav")
        .header("Content-Length", fileBuffer.length)
        .header("Cache-Control", "public, max-age=3600")
        .send(fileBuffer);
    },
  );

  app.get("/v1/voice/files", async (_req: FastifyRequest, reply: FastifyReply) => {
    const { readdir } = await import("fs/promises");
    try {
      const files = await readdir(KOZY_OUT_DIR);
      const wavFiles = files.filter((f) => f.endsWith(".wav")).sort().reverse().slice(0, 20);

      const details = await Promise.all(
        wavFiles.map(async (f) => {
          const resolved = path.resolve(KOZY_OUT_DIR, f);
          try {
            const s = await stat(resolved);
            return { filename: f, size_bytes: s.size, modified: s.mtime.toISOString() };
          } catch {
            return { filename: f, size_bytes: 0, modified: null };
          }
        }),
      );

      return reply.send({
        ok: true,
        out_dir: KOZY_OUT_DIR,
        total_wav: wavFiles.length,
        recent: details,
      });
    } catch {
      return reply.status(500).send({
        ok: false,
        error: "cannot list voice files",
      });
    }
  });
}
