import "dotenv/config";
import path from "path";
import fs from "fs";
import { buildIntelCard } from "../src/intel/intelParse.js";
import { saveIntelCard, listInboxJsonFiles } from "../src/intel/intelStore.js";
import { runDigestWeekly } from "../src/intel/intelDigest.js";
import { writeBuildTaskFromPackCandidate } from "../src/intel/buildTask.js";

function getRoot() {
  const root = (process.env.TELEGA_ROOT || "").trim();
  if (!root) throw new Error("TELEGA_ROOT is not set");
  return root;
}

function latestInboxFile(telegaRoot: string) {
  const files = listInboxJsonFiles(telegaRoot);
  return files[0] || null;
}

async function main() {
  const telegaRoot = getRoot();
  const text = "uCoz добавил контент-фильтр https://example.com/a";

  const first = buildIntelCard({ text });
  const r1 = saveIntelCard(telegaRoot, first);
  const afterFirst = latestInboxFile(telegaRoot);

  const second = buildIntelCard({ text });
  const r2 = saveIntelCard(telegaRoot, second);
  const afterSecond = latestInboxFile(telegaRoot);

  const digest = runDigestWeekly({ telegaRoot, days: 7, takeMax: 300 });
  const top = (digest.packCandidates || []).slice(0, 1);
  let buildTaskFile = null;
  if (top.length > 0) {
    const bt = writeBuildTaskFromPackCandidate({
      telegaRoot,
      digestId: digest.digestId,
      pack: top[0].pack,
      evidence: { notes: ["test_intel_flow"] },
    });
    buildTaskFile = bt.file;
  }

  const inboxDir = path.join(telegaRoot, "mission-control", "intel", "inbox");
  const digestDir = path.join(telegaRoot, "mission-control", "intel", "digests");
  const buildDir = path.join(telegaRoot, "mission-control", "buildtasks", "outbox");

  console.log("dedupe_first", r1.deduped === true ? "true" : "false");
  console.log("dedupe_second", r2.deduped === true ? "true" : "false");
  console.log("latest_inbox_first", afterFirst || "none");
  console.log("latest_inbox_second", afterSecond || "none");
  console.log("digest_json", digest.digestJsonFile);
  console.log("digest_md", digest.digestMdFile);
  console.log("buildtask_file", buildTaskFile || "none");
  console.log("inbox_exists", fs.existsSync(inboxDir));
  console.log("digests_exists", fs.existsSync(digestDir));
  console.log("buildtasks_exists", fs.existsSync(buildDir));
}

main().catch((e) => {
  console.error("test_intel_flow_failed", e?.message || e);
  process.exit(1);
});
