export function withTraceHeaders(
  res: Response,
  traceId: string,
  extra?: Record<string, string>
) {
  const h = new Headers(res.headers);
  h.set("x-telegpt-trace-id", traceId);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) h.set(k, v);
  }
  return new Response(res.body, { status: res.status, headers: h });
}
