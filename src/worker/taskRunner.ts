const HEARTBEAT_PING_SEC = 15;

export async function runTask(taskId: string) {
  const hb = setInterval(async () => {
    try {
      await fetch(`http://localhost:3000/api/v1/tasks/${taskId}/heartbeat`, {
        method: "POST",
      });
    } catch {
      // ignore
    }
  }, HEARTBEAT_PING_SEC * 1000);

  try {
    // ... твоя работа
    // по завершению:
    // PATCH status -> done/partial
  } finally {
    clearInterval(hb);
  }
}
