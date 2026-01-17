export function createSemaphore(max: number) {
  let inFlight = 0;
  const q: Array<() => void> = [];

  async function acquire() {
    if (inFlight < max) {
      inFlight++;
      return () => release();
    }
    await new Promise<void>((resolve) => q.push(resolve));
    inFlight++;
    return () => release();
  }

  function release() {
    inFlight = Math.max(0, inFlight - 1);
    const next = q.shift();
    if (next) next();
  }

  function stats() {
    return { inFlight, queued: q.length, max };
  }

  return { acquire, stats };
}
