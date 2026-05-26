import { NextResponse } from 'next/server';
import { executeWebProviderBridge } from '@/runtime/providers/web/web-provider-bridge';

export async function GET() {
  try {
    const result = await executeWebProviderBridge({
      providerId: 'openai_web',
      prompt: 'Hello from Tele•GPT Web Provider Bridge MVP',
    });

    return NextResponse.json({
      status: 'done',
      provider_id: result.providerId,
      bridge: 'ok',
      response: result.response.content,
      trace_id: result.traceId,
      request_id: result.requestId,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        provider_id: 'openai_web',
        bridge: 'failed',
        error: error.message,
        trace_id: `tr_${Date.now()}`,
      },
      { status: 500 }
    );
  }
}
