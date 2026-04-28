import { NextResponse } from "next/server";
import { db } from "@/core/db";
import { ensureDefaultLrlRules } from "@/core/lrl/lrlRules";

export async function GET() {
  ensureDefaultLrlRules();
  const items = db.lrl.listRules();
  return NextResponse.json({ ok: true, items });
}
