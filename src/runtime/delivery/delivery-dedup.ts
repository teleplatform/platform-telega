let lastKey = "";
let lastTs = 0;

export function dedupGuard(key: string, ttl = 5000): boolean {
  const now = Date.now();

  if (key === lastKey && now - lastTs < ttl) {
    return false;
  }

  lastKey = key;
  lastTs = now;
  return true;
}

export function clearDedupState(): void {
  lastKey = "";
  lastTs = 0;
}
