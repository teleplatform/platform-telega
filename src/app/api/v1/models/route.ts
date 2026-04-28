import { NextResponse } from "next/server";
import { localListModels } from "@/core/providers/localOpenAI";

export async function GET() {
  try {
    const models = await localListModels();
    return NextResponse.json({
      ok: true,
      provider: "local",
      models,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, provider: "local", error: e?.message || "models_failed" },
      { status: 500 }
    );
  }
}
