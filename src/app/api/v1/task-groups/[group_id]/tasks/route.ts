import { NextResponse } from "next/server";
import { getTaskGroup } from "@/runtime/forge-bridge/job-dispatcher";

export async function GET(req: Request, { params }: { params: { group_id: string } }) {
  const group = getTaskGroup(params.group_id);
  
  if (!group) {
    return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 });
  }

  const tasks = group.child_task_ids.map((task_id) => ({
    task_id,
    status: "queued",
  }));

  return NextResponse.json({
    ok: true,
    group_id: params.group_id,
    tasks,
  });
}