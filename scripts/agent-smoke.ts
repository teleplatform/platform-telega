import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

import { buildServer } from "../src/server/p2_storage.ts";

async function main() {
  // Maker-only CRUD endpoints must be gated
  process.env.TELEGA_MODE = "creator";

  const tmpDir = path.join(
    process.cwd(),
    ".data",
    `_smoke_agent_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
  fs.mkdirSync(tmpDir, { recursive: true });
  process.env.TELEGPT_DATA_DIR = tmpDir;

  const app = await buildServer();

  try {
    // Create pack
    const createPack = await app.inject({
      method: "POST",
      url: "/v1/knowledge/packs",
      payload: {
        title: "Smoke Pack",
        scope: "global",
        owner_id: "smoke",
        is_active: true,
      },
    });

    assert.equal(createPack.statusCode, 200);
    const packJson = createPack.json() as any;
    const packId = packJson?.id as string;
    assert.ok(packId);

    // Create doc
    const bodyMd = "Returns are accepted within 30 days of purchase with receipt.";
    const createDoc = await app.inject({
      method: "POST",
      url: "/v1/knowledge/docs",
      payload: {
        pack_id: packId,
        kind: "faq",
        title: "Return Policy",
        body_md: bodyMd,
      },
    });

    assert.equal(createDoc.statusCode, 200);
    const docJson = createDoc.json() as any;
    const docId = docJson?.id as string;
    assert.ok(docId);

    // Publish doc version
    const publish = await app.inject({
      method: "POST",
      url: `/v1/knowledge/docs/${docId}/publish`,
    });
    assert.equal(publish.statusCode, 200);

    // Ask agent
    const ask = await app.inject({
      method: "POST",
      url: "/v1/agent/sales-support/ask",
      payload: {
        mode: "support",
        scope: "global",
        message: "What is your return policy?",
      },
    });

    assert.equal(ask.statusCode, 200);
    const askJson = ask.json() as any;

    assert.ok(typeof askJson?.trace_id === "string");
    assert.ok(askJson?.decision);

    const decision = askJson.decision as any;
    assert.equal(decision.mode, "support");
    assert.ok(typeof decision.answer === "string" && decision.answer.length > 0);
    assert.ok(Array.isArray(decision.actions));
    assert.ok(Array.isArray(decision.citations));
    assert.ok(decision.citations.length >= 1);

    const c0 = decision.citations[0];
    assert.equal(c0.doc_id, docId);
    assert.ok(typeof c0.snippet === "string" && c0.snippet.includes("30 days"));
  } finally {
    await app.close();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
