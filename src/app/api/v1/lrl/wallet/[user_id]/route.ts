import { NextResponse } from "next/server";
import { db } from "@/core/db";

export async function GET(_: Request, ctx: { params: { user_id: string } }) {
  const user_id = ctx.params.user_id;
  const wallet = db.lrl.getWallet(user_id) ?? {
    user_id,
    teleton_balance: 0,
    bonus_points_balance: 0,
    updated_at: new Date().toISOString(),
  };
  const ledger = db.lrl.listLedger({ user_id, limit: 50 });

  return NextResponse.json({ ok: true, wallet, ledger });
}
