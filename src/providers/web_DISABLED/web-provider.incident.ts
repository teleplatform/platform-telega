export function detectAndUpdateRuntimeMode(): 'normal' | 'degraded' | 'incident' {
  return 'normal';
}

export function getCurrentRuntimeMode(): 'normal' | 'degraded' | 'incident' {
  return 'normal';
}

export function isDegradedMode(): boolean {
  return false;
}
