export class EvidenceLogger {
  async log(entry: Record<string, unknown>) {
    console.log(JSON.stringify({
      ...entry,
      ts: Date.now(),
    }));
  }
}
