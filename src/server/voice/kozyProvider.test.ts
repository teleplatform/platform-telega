import { kozySynthesize } from "./kozyProvider";

async function testEmptyTextRejection() {
  const result = await kozySynthesize({ text: "", trace_id: "test-empty" });
  if (result.ok) throw new Error("Should have rejected empty text");
  console.assert(result.error?.includes("text"), "Error should mention text");
  console.log("✅ testEmptyTextRejection passed");
}

async function testDisabledProvider() {
  const saved = process.env.KOZY_ENABLED;
  process.env.KOZY_ENABLED = "false";
  try {
    const result = await kozySynthesize({ text: "test", trace_id: "test-disabled" });
    if (result.ok) throw new Error("Should have rejected disabled provider");
    console.assert(result.error?.includes("disabled"), "Error should mention disabled");
    console.log("✅ testDisabledProvider passed");
  } finally {
    process.env.KOZY_ENABLED = saved ?? "true";
  }
}

async function testTextTooLong() {
  const result = await kozySynthesize({
    text: "x".repeat(6000),
    trace_id: "test-long",
  });
  if (result.ok) throw new Error("Should have rejected long text");
  console.assert(result.error?.includes("exceeds"), "Error should mention limit");
  console.log("✅ testTextTooLong passed");
}

async function testSpeedValidation() {
  const result = await kozySynthesize({
    text: "test",
    speed: 10.0,
    trace_id: "test-speed",
  });
  if (result.ok) throw new Error("Should have rejected invalid speed");
  console.assert(result.error?.includes("speed"), "Error should mention speed");
  console.log("✅ testSpeedValidation passed");
}

async function testKozyUnavailable() {
  const saved = process.env.KOZY_SERVER_URL;
  process.env.KOZY_SERVER_URL = "http://127.0.0.1:19999"; // nonexistent
  try {
    const result = await kozySynthesize({ text: "test", trace_id: "test-unavail" });
    // Should not crash, should return failure
    console.assert(!result.ok, "Should have failed");
    console.assert(result.error, "Should have error");
    console.log("✅ testKozyUnavailable passed");
  } finally {
    process.env.KOZY_SERVER_URL = saved ?? "http://127.0.0.1:8010";
  }
}

async function main() {
  await testEmptyTextRejection();
  await testDisabledProvider();
  await testTextTooLong();
  await testSpeedValidation();
  await testKozyUnavailable();
  console.log("\n✅ All kozy provider tests passed");
}

main().catch((e) => {
  console.error("❌ Test failed:", e);
  process.exit(1);
});
