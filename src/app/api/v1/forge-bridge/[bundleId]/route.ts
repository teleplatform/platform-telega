// ─────────────────────────────────────────────────────────────
// GET  /v1/forge-bridge/[bundleId]
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { forgeBridgeService } from "@/forge-bridge/service.js";
import { buildPacketView, buildSummary } from "@/forge-bridge/summary.js";
import { ForgeBundleNotFoundError } from "@/forge-bridge/errors.js";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ bundleId: string }> },
) {
  const params = await ctx.params;
  const bundleId = params.bundleId;

  try {
    const bundle = await forgeBridgeService.getBundle({ bundleId });
    return NextResponse.json({
      ok: true,
      bundle,
      packetView: buildPacketView(bundle),
      summary: buildSummary(bundle),
    });
  } catch (err: any) {
    if (err instanceof ForgeBundleNotFoundError) {
      return NextResponse.json(
        { ok: false, error: err.code, message: err.message },
        { status: 404 },
      );
    }
    console.error("[forge-bridge/[bundleId]] Error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to retrieve bundle" },
      { status: 500 },
    );
  }
}
