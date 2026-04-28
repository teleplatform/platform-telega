type Job<T> = () => Promise<T>;

const queues = new Map<string, Promise<any>>();

export function enqueue<T>(key: string, job: Job<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(job);
  queues.set(key, next);
  return next;
}
