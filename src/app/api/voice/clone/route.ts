import { NextResponse } from "next/server";
import { getAuthContext } from "../../_auth";
import { handleClone } from "@/server/voice/providerRouter";
import type { VoiceCloneRequest } from "@/server/voice/types";

export async function POST(req: Request) {
  const auth = await getAuthContext();
  const body = (await req.json()) as VoiceCloneRequest;
  const res = await handleClone(auth, body);
  return NextResponse.json(res, { status: res.status === "blocked" ? 403 : 200 });
}
