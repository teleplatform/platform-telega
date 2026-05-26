import { NextResponse } from "next/server";
import { createTaskGroup } from "@/runtime/forge-bridge/job-dispatcher";
import type { CreateTaskGroupParams } from "@/runtime/forge-bridge/task-group-types";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    
    const params: CreateTaskGroupParams = {
      parent_task_id: body?.parent_task_id,
      child_task_ids: Array.isArray(body?.child_task_ids) ? body.child_task_ids : [],
      group_strategy: body?.group_strategy ?? "parallel",
      execution_mode: body?.execution_mode,
    };

    const group = createTaskGroup(params);

    return NextResponse.json({
      ok: true,
      group_id: group.group_id,
      group_trace_id: group.group_trace_id,
      group_status: group.group_status,
      group_strategy: group.group_strategy,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}