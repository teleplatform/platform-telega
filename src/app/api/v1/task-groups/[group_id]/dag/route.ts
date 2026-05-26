import { NextResponse } from "next/server";
import { getTaskGroupStore } from "@/runtime/forge-bridge/task-group-store";

export async function GET(req: Request, { params }: { params: { group_id: string } }) {
  const store = getTaskGroupStore();
  
  try {
    const dag = await store.getTaskGroupDag(params.group_id);
    
    return NextResponse.json({
      ok: true,
      ...dag,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ ok: false, error: message }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}