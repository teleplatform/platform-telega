import { ok, fail } from "../llm/contract.ts";
import { llmTranslateToEN } from "../translate/llmTranslate.ts";

export async function registerTranslateRoute(server: any) {
  server.post("/translate", async (req: any, reply: any) => {
    const body = (req.body ?? {}) as any;
    const sourceText = body.sourceText;

    if (!sourceText || typeof sourceText !== "string") {
      return reply.status(400).send(fail("bad_request"));
    }

    const mode = (body.mode ?? "public") as "public" | "maker";

    if (mode === "public" && sourceText.length > 6000) {
      return reply.status(413).send(fail("limit"));
    }

    try {
      const r = await llmTranslateToEN({ sourceText, mode });

      if (!r.text?.trim()) {
        return reply
          .status(502)
          .send(
            fail("empty_translation", {
              model: "translategemma:en",
              tagUsed: "t",
              mode,
              debug: r.debug,
            })
          );
      }

      return reply.send(
        ok(
          { model: "translategemma:en", tagUsed: "t" },
          { translatedText: r.text },
          mode,
          r.debug
        )
      );
    } catch (e: any) {
      return reply
        .status(502)
        .send(
          fail("translate_failed", {
            message: e?.message ?? "unknown",
            model: "translategemma:en",
            tagUsed: "t",
            mode,
          })
        );
    }
  });
}
