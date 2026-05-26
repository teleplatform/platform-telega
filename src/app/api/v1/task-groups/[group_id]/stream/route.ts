import { NextResponse } from "next/server";
import { getTaskGroupStreamStore } from "@/runtime/forge-bridge/task-group-stream-store";

export async function GET(req: Request, { params }: { params: { group_id: string } }) {
  const url = new URL(req.url);
  const sequenceParam = url.searchParams.get("sequence");
  const sequence = sequenceParam ? parseInt(sequenceParam, 10) : 0;

  const store = getTaskGroupStreamStore();
  const events = store.getStreamEvents(params.group_id);
  
  const newEvents = sequence < events.length 
    ? events.slice(sequence) 
    : [];

  return NextResponse.json({
    ok: true,
    group_id: params.group_id,
    sequence,
    events: newEvents,
  });
}