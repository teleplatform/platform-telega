// ─────────────────────────────────────────────────────────────
// Alice Webhook HTTP Entry Route
//
// POST /api/v1/alice/webhook
//
// Accepts Alice-like POST requests, validates boundary,
// hands off to protocol adapter, returns JSON-safe response.
// Contains no business logic — pure HTTP boundary layer.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { handleAliceHttpEntry } from "@/alice-http/adapter.js";
import { BUILTIN_ENTRY_PATTERNS } from "@/alice-bridge/builtin.js";

export async function POST(req: Request) {
  try {
    const rawHeaders: Record<string, string | undefined> = {};
    req.headers.forEach((value, key) => {
      rawHeaders[key] = value;
    });

    let rawBody: unknown = null;
    try {
      rawBody = await req.json();
    } catch {
      // Malformed JSON — reject at boundary
      return NextResponse.json(
        { error: true, message: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const response = handleAliceHttpEntry(
      "POST",
      rawHeaders,
      rawBody,
      undefined, // simulated runtime context — none in live mode
      BUILTIN_ENTRY_PATTERNS,
    );

    return NextResponse.json(response.body, { status: response.statusCode });
  } catch {
    // Never leak internals
    return NextResponse.json(
      { error: true, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: true, message: "Method not allowed. Only POST is accepted." },
    { status: 405 },
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: true, message: "Method not allowed. Only POST is accepted." },
    { status: 405 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: true, message: "Method not allowed. Only POST is accepted." },
    { status: 405 },
  );
}
