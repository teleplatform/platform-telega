// ─────────────────────────────────────────────────────────────
// GET  /v1/forge-bridge/artifact/[artifactId]
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { forgeBridgeService } from "@/forge-bridge/service.js";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ artifactId: string }> },
) {
  const params = await ctx.params;
  const artifactId = params.artifactId;

  try {
    const bundles = await forgeBridgeService.getBundlesByArtifact({ artifactId });
    return NextResponse.json({
      ok: true,
      bundles,
      count: bundles.length,
    });
  } catch (err: any) {
    console.error("[forge-bridge/artifact/[artifactId]] Error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to retrieve bundles by artifact" },
      { status: 500 },
    );
  }
}
