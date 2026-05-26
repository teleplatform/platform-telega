export interface PressureSignal {
  signal_id: string;
  detected_at: string;
  level: "normal" | "elevated" | "critical";
  reasons: string[];
}

export function detectPressure(): PressureSignal {
  return {
    signal_id: `pressure_${Date.now()}`,
    detected_at: new Date().toISOString(),
    level: "normal",
    reasons: [],
  };
}
