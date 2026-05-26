import { NextResponse } from "next/server";
import { getTaskGroup } from "@/runtime/forge-bridge/job-dispatcher";
import { aggregateTaskGroupStatus } from "@/runtime/forge-bridge/task-group-types";

export async function GET(req: Request, { params }: { params: { group_id: string } }) {
  const group = getTaskGroup(params.group_id);
  
  if (!group) {
    return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 });
  }

  const aggregated_status = aggregateTaskGroupStatus([]);

  return NextResponse.json({
    ok: true,
    group_id: group.group_id,
    group_status: group.group_status,
    group_strategy: group.group_strategy,
    group_trace_id: group.group_trace_id,
    parent_task_id: group.parent_task_id,
    child_task_ids: group.child_task_ids,
    created_at: group.created_at,
    updated_at: group.updated_at,
    aggregated_status,
  });
}