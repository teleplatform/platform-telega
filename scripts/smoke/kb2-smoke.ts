import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

import { buildServer } from "../src/server/p2_storage.ts";

async function main() {
  const tmpDir = path.join(
    process.cwd(),
    ".data",
    `_smoke_kb2_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
  fs.mkdirSync(tmpDir, { recursive: true });

  process.env.TELEGPT_DATA_DIR = tmpDir;
  process.env.TELEGA_MODE = "creator";
  process.env.TELEGPT_AGENT_MODE = "true";

  const app = await buildServer();

  try {
    const business_id = "smoke-biz";

    // v1
    const put1 = await app.inject({
      method: "PUT",
      url: `/v1/knowledge/${business_id}`,
      payload: {
        payload: {
          business_name: "Smoke Biz",
          policy_hints: { intent_overrides: { booking: "smart" } },
        },
        expected_version: 0,
      },
    });

    assert.equal(put1.statusCode, 200);
    const put1Json = put1.json() as any;
    assert.equal(put1Json.business_id, business_id);
    assert.equal(put1Json.version, 1);

    const ask1 = await app.inject({
      method: "POST",
      url: `/v1/ask?knowledge_business_id=${encodeURIComponent(business_id)}`,
      payload: { message: "Can you book an appointment for tomorrow?" },
    });

    assert.equal(ask1.statusCode, 200);
    const ask1Json = ask1.json() as any;
    assert.equal(ask1Json?.meta?.knowledge_source, "db");
    assert.equal(ask1Json?.meta?.knowledge_version, 1);
    assert.equal(ask1Json?.meta?.lane_source, "override");

    // v2
    const put2 = await app.inject({
      method: "PUT",
      url: `/v1/knowledge/${business_id}`,
      payload: {
        payload: {
          business_name: "Smoke Biz v2",
          policy_hints: { intent_overrides: { booking: "coding" } },
        },
        expected_version: 1,
      },
    });

    assert.equal(put2.statusCode, 200);
    const put2Json = put2.json() as any;
    assert.equal(put2Json.version, 2);

    const ask2 = await app.inject({
      method: "POST",
      url: `/v1/ask?knowledge_business_id=${encodeURIComponent(business_id)}`,
      payload: { message: "Please book me for next week." },
    });

    assert.equal(ask2.statusCode, 200);
    const ask2Json = ask2.json() as any;
    assert.equal(ask2Json?.meta?.knowledge_source, "db");
    assert.equal(ask2Json?.meta?.knowledge_version, 2);
    assert.equal(ask2Json?.meta?.lane_source, "override");

    // CAS conflict
    const putConflict = await app.inject({
      method: "PUT",
      url: `/v1/knowledge/${business_id}`,
      payload: {
        payload: { business_name: "nope" },
        expected_version: 1,
      },
    });

    assert.equal(putConflict.statusCode, 409);
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
