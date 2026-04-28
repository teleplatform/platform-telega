// ─────────────────────────────────────────────────────────────
// POST /v1/forge-bridge/from-execution
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { forgeBridgeService } from "@/forge-bridge/service.js";
import { buildPacketView, buildSummary } from "@/forge-bridge/summary.js";
import {
  ForgeBundleDuplicateError,
  ForgeBundleInvalidError,
  ForgeBundleLanguageUnresolvedError,
  ForgeBundlePersonaInvalidError,
} from "@/forge-bridge/errors.js";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const {
      execution_id,
      artifact_id,
      actor_id,
      actor_role,
      requested_language,
      persona_mode,
    } = body as Record<string, any>;

    if (!execution_id || !artifact_id) {
      return NextResponse.json(
        { ok: false, error: "missing_required_fields", detail: "execution_id and artifact_id are required" },
        { status: 400 },
      );
    }

    const bundle = await forgeBridgeService.createBundleFromExecution({
      executionId: execution_id,
      artifactId: artifact_id,
      artifactType: body.artifact_type ?? "unknown",
      intentClass: body.intent_class ?? "general",
      title: body.title ?? `Bundle for execution ${execution_id}`,
      summary: body.summary ?? "",
      actorId: actor_id,
      actorRole: actor_role,
      taskId: body.task_id,
      traceId: body.trace_id,
      executionState: body.execution_state,
      originSurface: body.origin_surface,
      requestedLanguage: requested_language,
      profileLanguage: body.profile_language,
      conversationLanguage: body.conversation_language,
      personaMode: persona_mode,
      payloadRef: body.payload_ref,
      payloadInline: body.payload_inline,
    });

    return NextResponse.json({
      ok: true,
      bundle,
      packetView: buildPacketView(bundle),
      summary: buildSummary(bundle),
    });
  } catch (err: any) {
    if (err instanceof ForgeBundleDuplicateError) {
      return NextResponse.json(
        { ok: false, error: err.code, message: err.message },
        { status: 409 },
      );
    }
    if (err instanceof ForgeBundleInvalidError) {
      return NextResponse.json(
        { ok: false, error: err.code, message: err.message },
        { status: 400 },
      );
    }
    if (err instanceof ForgeBundleLanguageUnresolvedError) {
      return NextResponse.json(
        { ok: false, error: err.code, message: err.message },
        { status: 400 },
      );
    }
    if (err instanceof ForgeBundlePersonaInvalidError) {
      return NextResponse.json(
        { ok: false, error: err.code, message: err.message },
        { status: 400 },
      );
    }
    console.error("[forge-bridge/from-execution] Error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to create bundle from execution" },
      { status: 500 },
    );
  }
}
