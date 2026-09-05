export interface LiveEvent {
  id: string;
  timestamp: string;
  kind: string;
  source: string;
  summary: string;
  details: Record<string, unknown>;
  severity: "info" | "warning" | "critical";
}

export interface LiveAlert {
  id: string;
  timestamp: string;
  kind: string;
  message: string;
  severity: "warning" | "critical";
  acknowledged: boolean;
}

export interface LiveRuntimeStatus {
  missions: { total: number; active: number; failed: number };
  graphs: { total: number; running: number; failed: number };
  sessions: { total: number; active: number };
  surfaces: { total: number; active: number };
  outcomes: { total: number; recent: number };
  providers: { total: number; active: number };
}

export interface LiveDashboard {
  feed: LiveEvent[];
  alerts: LiveAlert[];
  status: LiveRuntimeStatus;
  updatedAt: string;
}
