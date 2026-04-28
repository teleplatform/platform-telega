let success = 0;
let blocked = 0;
let error = 0;
let fallback = 0;

export function recordMetric(type: "success" | "blocked" | "error" | "fallback") {
  if (type === "success") success++;
  if (type === "blocked") blocked++;
  if (type === "error") error++;
  if (type === "fallback") fallback++;
}

export function getCounters() {
  return { success, blocked, error, fallback };
}

export function resetMetrics() {
  success = 0;
  blocked = 0;
  error = 0;
  fallback = 0;
}
